const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.gg_token;
    if (!token) return res.status(401).json({ ok: false, message: 'Brak sesji' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Sesja wygasła lub nieprawidłowa' });
  }
}

async function getListingOr404(listingId) {
  const r = await pool.query(
    'SELECT id, user_id, type_id, price FROM listing WHERE id = $1',
    [listingId]
  );
  if (r.rowCount === 0) return null;
  return r.rows[0];
}

router.post('/start', authRequired, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { listingId, price } = req.body;

    const lid = Number(listingId);
    const p = Number(price);

    if (!Number.isFinite(lid) || lid <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId.' });
    }
    if (!Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowa cena.' });
    }

    const listing = await getListingOr404(lid);
    if (!listing) return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje.' });

    if (Number(listing.type_id) !== 1) {
      return res.status(400).json({ ok: false, error: 'Oferty ceny tylko dla ogłoszeń sprzedaży.' });
    }

    const sellerId = Number(listing.user_id);
    if (sellerId === buyerId) {
      return res.status(400).json({ ok: false, error: 'Nie możesz złożyć oferty na własne ogłoszenie.' });
    }

    let negotiationId = null;

    const findOpen = await pool.query(
      `
      SELECT id
      FROM price_negotiation
      WHERE listing_id = $1 AND buyer_id = $2 AND seller_id = $3 AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [lid, buyerId, sellerId]
    );

    if (findOpen.rowCount > 0) {
      negotiationId = findOpen.rows[0].id;
    } else {
      const created = await pool.query(
        `
        INSERT INTO price_negotiation (listing_id, buyer_id, seller_id, status)
        VALUES ($1, $2, $3, 'open')
        RETURNING id
        `,
        [lid, buyerId, sellerId]
      );

      negotiationId = created.rows[0]?.id || null;

      if (!negotiationId) {
        return res.status(500).json({ ok: false, error: 'Nie udało się utworzyć negocjacji.' });
      }
    }
    const checkNego = await pool.query(
      'SELECT status FROM price_negotiation WHERE id = $1',
      [negotiationId]
    );
    if (checkNego.rowCount === 0 || checkNego.rows[0].status !== 'open') {
      return res.status(400).json({ ok: false, error: 'Negocjacja jest zamknięta.' });
    }

    await pool.query('BEGIN');
    try {
 
      const pendingRes = await pool.query(
        `
        SELECT id, proposed_by
        FROM price_offer
        WHERE negotiation_id = $1 AND status = 'pending'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [negotiationId]
      );

      if (pendingRes.rowCount > 0) {
        const pending = pendingRes.rows[0];
        if (pending.proposed_by === 'buyer') {
          await pool.query('ROLLBACK');
          return res.status(400).json({ ok: false, error: 'Wysłałeś już ofertę. Poczekaj na odpowiedź drugiej strony.' });
        }

        // pending jest od sprzedającego -> wysyłając kontrę automatycznie odrzucamy poprzednią pending
        await pool.query(
          `UPDATE price_offer SET status = 'rejected' WHERE negotiation_id = $1 AND status = 'pending'`,
          [negotiationId]
        );
      }

      const insert = await pool.query(
        `
        INSERT INTO price_offer (negotiation_id, listing_id, buyer_id, seller_id, price, status, proposed_by)
        VALUES ($1, $2, $3, $4, $5, 'pending', 'buyer')
        RETURNING id, negotiation_id, listing_id, buyer_id, seller_id, price, status, proposed_by, created_at
        `,
        [negotiationId, lid, buyerId, sellerId, p]
      );

      await pool.query('COMMIT');
      return res.status(201).json({ ok: true, negotiationId, offer: insert.rows[0] });
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('POST /price-offers/start error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});

router.post('/:negotiationId/offer', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const negotiationId = Number(req.params.negotiationId);
    const p = Number(req.body?.price);

    if (!Number.isFinite(negotiationId) || negotiationId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe negotiationId.' });
    }
    if (!Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowa cena.' });
    }

    const negoRes = await pool.query('SELECT * FROM price_negotiation WHERE id = $1', [negotiationId]);
    if (negoRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Negocjacja nie istnieje.' });

    const nego = negoRes.rows[0];

    if (nego.status !== 'open') {
      return res.status(400).json({ ok: false, error: 'Negocjacja jest zamknięta.' });
    }

    const buyerId = Number(nego.buyer_id);
    const sellerId = Number(nego.seller_id);

    if (userId !== buyerId && userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Brak uprawnień.' });
    }

    const proposedBy = userId === sellerId ? 'seller' : 'buyer';

    await pool.query('BEGIN');
    try {
      const pendingRes = await pool.query(
        `
        SELECT id, proposed_by
        FROM price_offer
        WHERE negotiation_id = $1 AND status = 'pending'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [negotiationId]
      );

      if (pendingRes.rowCount > 0) {
        const pending = pendingRes.rows[0];
        if (pending.proposed_by === proposedBy) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ ok: false, error: 'Wysłałeś już ofertę. Poczekaj na odpowiedź drugiej strony.' });
        }

        await pool.query(
          `UPDATE price_offer SET status = 'rejected' WHERE negotiation_id = $1 AND status = 'pending'`,
          [negotiationId]
        );
      }

      const insert = await pool.query(
        `
        INSERT INTO price_offer (negotiation_id, listing_id, buyer_id, seller_id, price, status, proposed_by)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
        RETURNING id, negotiation_id, listing_id, buyer_id, seller_id, price, status, proposed_by, created_at
        `,
        [negotiationId, nego.listing_id, buyerId, sellerId, p, proposedBy]
      );

      await pool.query(`UPDATE price_negotiation SET updated_at = NOW() WHERE id = $1`, [negotiationId]);

      await pool.query('COMMIT');
      return res.status(201).json({ ok: true, offer: insert.rows[0] });
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('POST /price-offers/:negotiationId/offer error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});


router.get('/negotiation', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = Number(req.query.listingId);
    const otherUserId = Number(req.query.otherUserId);

    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId.' });
    }
    if (!Number.isFinite(otherUserId) || otherUserId <= 0 || otherUserId === userId) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe otherUserId.' });
    }

    const negoRes = await pool.query(
      `
      SELECT *
      FROM price_negotiation
      WHERE listing_id = $1
        AND (
          (buyer_id = $2 AND seller_id = $3) OR
          (buyer_id = $3 AND seller_id = $2)
        )
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [listingId, userId, otherUserId]
    );

    if (negoRes.rowCount === 0) {
      return res.json({ ok: true, negotiation: null, offers: [] });
    }

    const negotiation = negoRes.rows[0];

    const offersRes = await pool.query(
      `
      SELECT id, negotiation_id, listing_id, buyer_id, seller_id, price, status, proposed_by, created_at
      FROM price_offer
      WHERE negotiation_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [negotiation.id]
    );

    return res.json({ ok: true, negotiation, offers: offersRes.rows });
  } catch (e) {
    console.error('GET /price-offers/negotiation error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});


router.post('/offer/:id/accept', authRequired, async (req, res) => {
  try {
    const offerId = Number(req.params.id);
    const userId = req.user.id;

    const offerRes = await pool.query('SELECT * FROM price_offer WHERE id = $1', [offerId]);
    if (offerRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Oferta nie istnieje.' });

    const offer = offerRes.rows[0];
    const negotiationId = Number(offer.negotiation_id);

    if (!negotiationId) {
      return res.status(400).json({ ok: false, error: 'Ta oferta nie jest częścią negocjacji.' });
    }

    const negoRes = await pool.query('SELECT * FROM price_negotiation WHERE id = $1', [negotiationId]);
    if (negoRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Negocjacja nie istnieje.' });

    const nego = negoRes.rows[0];

    const buyerId = Number(nego.buyer_id);
    const sellerId = Number(nego.seller_id);

    if (userId !== buyerId && userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Brak uprawnień.' });
    }
    if (nego.status !== 'open') {
      return res.status(400).json({ ok: false, error: 'Negocjacja jest już zamknięta.' });
    }

    if (offer.proposed_by === 'buyer' && userId === buyerId) {
      return res.status(400).json({ ok: false, error: 'Nie możesz zaakceptować własnej oferty.' });
    }
    if (offer.proposed_by === 'seller' && userId === sellerId) {
      return res.status(400).json({ ok: false, error: 'Nie możesz zaakceptować własnej oferty.' });
    }

    await pool.query(
      `
      UPDATE price_negotiation
      SET status = 'accepted', accepted_offer_id = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'open'
      `,
      [offerId, negotiationId]
    );

    await pool.query(
      `
      UPDATE price_offer
      SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END
      WHERE negotiation_id = $2 AND status = 'pending'
      `,
      [offerId, negotiationId]
    );

    await pool.query(`UPDATE listing SET price = $1 WHERE id = $2`, [offer.price, offer.listing_id]);

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /price-offers/offer/:id/accept error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});


router.post('/:negotiationId/reject', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const negotiationId = Number(req.params.negotiationId);

    if (!Number.isFinite(negotiationId) || negotiationId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe negotiationId.' });
    }

    const negoRes = await pool.query('SELECT * FROM price_negotiation WHERE id = $1', [negotiationId]);
    if (negoRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Negocjacja nie istnieje.' });

    const nego = negoRes.rows[0];

    const buyerId = Number(nego.buyer_id);
    const sellerId = Number(nego.seller_id);

    if (userId !== buyerId && userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Brak uprawnień.' });
    }

    if (nego.status !== 'open') {
      return res.status(400).json({ ok: false, error: 'Negocjacja jest już zamknięta.' });
    }

    await pool.query(
      `UPDATE price_negotiation SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [negotiationId]
    );

    await pool.query(
      `UPDATE price_offer SET status = 'rejected' WHERE negotiation_id = $1 AND status = 'pending'`,
      [negotiationId]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /price-offers/:negotiationId/reject error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});

module.exports = router;