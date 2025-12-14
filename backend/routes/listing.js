const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db');


let multer, fs, path;
try {
  multer = require('multer');
  fs = require('fs');
  path = require('path');
} catch (e) {
  console.warn('[listing.js] Multer not available yet. Image upload route will be disabled until installed.');
}

const SOLD_STATUS_ID = 3;

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

router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM category ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania kategorii:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/subcategories', async (req, res) => {
  try {
    const { category_id } = req.query;
    if (!category_id) return res.status(400).json({ error: 'category_id wymagane' });
    const idNum = Number(category_id);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Nieprawidlowe category_id' });

    const { rows } = await pool.query(
      'SELECT id, name FROM subcategory WHERE category_id = $1 ORDER BY name ASC',
      [idNum]
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania podkategorii:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.post('/', authRequired, async (req, res) => {
  const {
    title,
    description,
    location,
    status_id,
    type_id,
    category_id,
    subcategory_id,
    helpType,
    price,
    isFree,
    negotiable,
    condition,

    // pola związane z ogłoszeniami o pracę
    salary,
    employmentType,
    employment_type,
    jobMode,
    job_mode,
    jobCategory,
    job_category,
    requirements,
  } = req.body;

  const catId =
    category_id === null ||
    category_id === '' ||
    typeof category_id === 'undefined'
      ? null
      : Number(category_id);

  const subId =
    subcategory_id === null ||
    subcategory_id === '' ||
    typeof subcategory_id === 'undefined'
      ? null
      : Number(subcategory_id);

  if (catId !== null && Number.isNaN(catId)) {
    return res.status(400).json({ error: 'Nieprawidłowe category_id' });
  }
  if (subId !== null && Number.isNaN(subId)) {
    return res.status(400).json({ error: 'Nieprawidłowe subcategory_id' });
  }

  if (!title || !description) {
    return res.status(400).json({ error: 'Tytul i opis wymagane!' });
  }

  const numericTypeId = Number(type_id);
  if (Number.isNaN(numericTypeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe type_id' });
  }


  let priceValue = null;
  let itemCondition = null;
  let isFreeValue = false;
  let negotiableValue = false;


  if (numericTypeId === 1) {
    const free = isFree === true || isFree === 'true';

    if (free) {

      priceValue = 0;
      isFreeValue = true;
    } else if (
      price !== null &&
      price !== '' &&
      typeof price !== 'undefined'
    ) {
      const num = Number(price);
      if (Number.isNaN(num)) {
        return res.status(400).json({ error: 'Nieprawidłowa cena' });
      }
      priceValue = num;
    } else {
      priceValue = null;
    }

    itemCondition = condition || null;
    negotiableValue = !!negotiable;
  }

  // Normalizacja pól dla ogłoszeń o pracę
  const salaryValue =
    salary === null || typeof salary === 'undefined' || salary === ''
      ? null
      : Number.isNaN(Number(salary))
      ? null
      : Number(salary);

  const employmentTypeValue = employment_type || employmentType || null;
  const workModeValue = job_mode || jobMode || null;
  const jobCategoryValue = job_category || jobCategory || null;
  const requirementsValue = requirements || null;

  try {
    const result = await pool.query(
      `INSERT INTO listing (
          title,
          description,
          location,
          status_id,
          type_id,
          category_id,
          subcategory_id,
          user_id,
          help_type,
          price,
          item_condition,
          is_free,
          negotiable,
          salary,
          employment_type,
          work_mode,
          job_category,
          requirements
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        title,
        description,
        location,
        status_id,
        numericTypeId,
        catId,
        subId,
        req.user.id,
        numericTypeId === 2 ? helpType || null : null,
        priceValue,
        itemCondition,
        isFreeValue,
        negotiableValue,
        salaryValue,
        employmentTypeValue,
        workModeValue,
        jobCategoryValue,
        requirementsValue,
      ]
    );

    const created = result.rows[0];

    const images =
      created.type_id === 1 && Array.isArray(req.body.images)
        ? req.body.images
        : [];

    if (images.length > 0) {
      const values = [];
      const placeholders = [];

      images.forEach((dataUrl, i) => {
        const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
        if (!match) return;
        const mime = match[1];
        const b64 = match[2];
        const buf = Buffer.from(b64, 'base64');
        values.push(created.id, mime, buf.length, buf, i);
        const base = i * 5;
        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
        );
      });

      if (placeholders.length) {
        await pool.query(
          `INSERT INTO listing_images (listing_id, mime, size, data, sort_order) VALUES ${placeholders.join(
            ','
          )}`,
          values
        );
      }
    }

    // DODAJEMY 10 punktów użytkownikowi
    const pointsResult = await pool.query(
      `UPDATE "user"
       SET points = points + 10
       WHERE id = $1
       RETURNING points`,
      [req.user.id]
    );

    const newPoints = pointsResult.rows[0]?.points ?? null;

    // Zwracamy też aktualną liczbę punktów
    res.status(201).json({
      message: 'Ogloszenie stworzone',
      listing: created,
      points: newPoints,
    });
  } catch (err) {
    console.error('Blad podczas dodawania ogloszenia', err.message);
    res
      .status(500)
      .json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/', async (req, res) => {

  const SOLD_STATUS_ID = 3;
  const HISTORY_STATUS_ID = 4;

  try {
    const {
      type_id,
      category_id,
      subcategory_id,
      category,
      help_type,
      page,
      limit
    } = req.query;

    const where = [];
    const params = [];

    if (type_id) {
      const v = Number(type_id);
      if (Number.isNaN(v)) {
        return res.status(400).json({ error: 'Nieprawidlowe type_id' });
      }
      params.push(v);
      where.push(`l.type_id = $${params.length}`);
    }

    if (category_id) {
      const v = Number(category_id);
      if (Number.isNaN(v)) {
        return res.status(400).json({ error: 'Nieprawidlowe category_id' });
      }
      params.push(v);
      where.push(`l.category_id = $${params.length}`);
    }

    if (help_type) {
      params.push(String(help_type));
      where.push(`l.help_type = $${params.length}`);
    }

    if (subcategory_id) {
      const v = Number(subcategory_id);
      if (Number.isNaN(v)) {
        return res.status(400).json({ error: 'Nieprawidlowe subcategory_id' });
      }
      params.push(v);
      where.push(`l.subcategory_id = $${params.length}`);
    }

    if (category) {
      params.push(String(category).toLowerCase());
      where.push(
        `l.category_id IN (
          SELECT id FROM category WHERE LOWER(name) = $${params.length}
        )`
      );
    }

    // Ukrywamy ogłoszenia sprzedane z głównej listy
    where.push(`(l.status_id IS NULL OR (l.status_id <> ${SOLD_STATUS_ID} AND l.status_id <> ${HISTORY_STATUS_ID}))`);


    // paginacja – domyślnie 20 ogłoszeń na stronę
    let pageNum = Number(page) || 1;
    let limitNum = Number(limit) || 20;

    if (!Number.isFinite(pageNum) || pageNum < 1) pageNum = 1;
    if (!Number.isFinite(limitNum) || limitNum < 1 || limitNum > 100) limitNum = 20;

    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const sql = `
      SELECT
        l.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar_url,
        (
          SELECT COALESCE(
            li.path,
            'data:' || li.mime || ';base64,' || encode(li.data,'base64')
          )
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
          LIMIT 1
        ) AS primary_image
      FROM listing l
      JOIN "user" u ON u.id = l.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania ofert:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/my', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        l.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar_url,
        c.name AS category_name,
        s.name AS subcategory_name,
        (
          SELECT COALESCE(
            li.path,
            'data:' || li.mime || ';base64,' || encode(li.data, 'base64')
          )
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
          LIMIT 1
        ) AS primary_image
      FROM listing l
      JOIN "user" u ON u.id = l.user_id
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN subcategory s ON s.id = l.subcategory_id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania moich ogloszen:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/user/:id', async (req, res) => {
  const uid = Number(req.params.id);
  if (Number.isNaN(uid)) return res.status(400).json({ error: 'Nieprawidlowe id' });

  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.username AS author_username, u.avatar_url AS author_avatar_url
       FROM listing l
       JOIN "user" u ON u.id = l.user_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania ogloszen uzytkownika:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});


// Wyróżnione ogłoszenia (wszystkich użytkowników)
router.get('/featured', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar_url,
        (
          SELECT COALESCE(
            li.path,
            'data:' || li.mime || ';base64,' || encode(li.data,'base64')
          )
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
          LIMIT 1
        ) AS primary_image
      FROM listing l
      JOIN "user" u ON u.id = l.user_id
      WHERE l.is_featured = TRUE
        AND (l.status_id IS NULL OR l.status_id <> 3)
      ORDER BY l.created_at DESC
      LIMIT 50
      `
    );

    res.json(rows);
  } catch (err) {
    console.error('Błąd pobierania wyróżnionych ogłoszeń:', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});



// lista ulubionych dla zalogowanego użytkownika
router.get('/favorites', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar_url,
        (
          SELECT COALESCE(
            li.path,
            'data:' || li.mime || ';base64,' || encode(li.data,'base64')
          )
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
          LIMIT 1
        ) AS primary_image
      FROM favorite_listing f
      JOIN listing l ON l.id = f.listing_id
      JOIN "user"  u ON u.id = l.user_id
      WHERE f.user_id = $1
      ORDER BY l.created_at DESC
      `,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Błąd pobierania ulubionych ogłoszeń:', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});

// dodanie ogłoszenia do ulubionych
router.post('/favorites/:id', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe id ogłoszenia' });
  }

  try {
    await pool.query(
      `
      INSERT INTO favorite_listing (user_id, listing_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, listing_id) DO NOTHING
      `,
      [req.user.id, listingId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Błąd dodawania do ulubionych:', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});

// usunięcie ogłoszenia z ulubionych
router.delete('/favorites/:id', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe id ogłoszenia' });
  }

  try {
    await pool.query(
      `
      DELETE FROM favorite_listing
      WHERE user_id = $1 AND listing_id = $2
      `,
      [req.user.id, listingId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Błąd usuwania z ulubionych:', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});


// Włączenie/wyłączenie wyróżnienia ogłoszenia (tylko właściciel)
router.patch('/:id/featured', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE listing
      SET is_featured = NOT is_featured
      WHERE id = $1 AND user_id = $2
      RETURNING is_featured
      `,
      [listingId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    }

    res.json({
      ok: true,
      is_featured: result.rows[0].is_featured,
    });
  } catch (err) {
    console.error('Błąd przełączania wyróżnienia:', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});



router.delete('/:id', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);

  try {
    if (!listingId) {
      return res.status(400).json({ message: 'Nieprawidłowe ID ogłoszenia.' });
    }

    // 1. Usuń wszystkie wiadomości powiązane z ogłoszeniem
    await pool.query(
      'DELETE FROM message WHERE listing_id = $1',
      [listingId]
    );

    // 2. Pobierz zdjęcia, żeby usunąć fizyczne pliki
    const { rows: images } = await pool.query(
      'SELECT path FROM listing_images WHERE listing_id = $1',
      [listingId]
    );

    // 3. Usuń rekordy zdjęć
    await pool.query(
      'DELETE FROM listing_images WHERE listing_id = $1',
      [listingId]
    );

    // 4. Usuń pliki zdjęć
    for (const img of images) {
      if (!img.path) continue;
      const filePath = path.join(process.cwd(), 'backend', img.path);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Błąd przy usuwaniu pliku:', err);
        });
      }
    }

    // 5. Usuń ogłoszenie
    await pool.query(
      'DELETE FROM listing WHERE id = $1',
      [listingId]
    );

    res.json({
      ok: true,
      message: 'Ogłoszenie, zdjęcia oraz powiązane wiadomości zostały usunięte.'
    });

  } catch (err) {
    console.error('Błąd przy usuwaniu ogłoszenia:', err);
    res.status(500).json({ message: 'Błąd serwera przy usuwaniu ogłoszenia.' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);

  const {
    title,
    description,
    location,
    category_id,
    subcategory_id,
    condition,
    price,
    isFree,
    is_free,
    negotiable,
    type_id,
  } = req.body;

  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
  }

  const catId =
    category_id === null || category_id === '' || typeof category_id === 'undefined'
      ? null
      : Number(category_id);

  const subId =
    subcategory_id === null || subcategory_id === '' || typeof subcategory_id === 'undefined'
      ? null
      : Number(subcategory_id);

  if (catId !== null && Number.isNaN(catId)) {
    return res.status(400).json({ error: 'Nieprawidłowe category_id' });
  }
  if (subId !== null && Number.isNaN(subId)) {
    return res.status(400).json({ error: 'Nieprawidłowe subcategory_id' });
  }

  const condValue =
    typeof condition === 'undefined' || condition === null || String(condition).trim() === ''
      ? null
      : String(condition).trim();

  const hasPrice = Object.prototype.hasOwnProperty.call(req.body, 'price');
  const hasIsFree =
    Object.prototype.hasOwnProperty.call(req.body, 'isFree') ||
    Object.prototype.hasOwnProperty.call(req.body, 'is_free');
  const hasNegotiable = Object.prototype.hasOwnProperty.call(req.body, 'negotiable');

  const freeRaw = typeof is_free !== 'undefined' ? is_free : isFree;
  const isFreeValue = typeof freeRaw === 'string' ? freeRaw === 'true' : Boolean(freeRaw);

  const negotiableValueRaw = typeof negotiable === 'undefined' ? undefined : negotiable;
  const negotiableValue =
    typeof negotiableValueRaw === 'string'
      ? negotiableValueRaw === 'true'
      : Boolean(negotiableValueRaw);

  let listingTypeId = Number(type_id);
  if (!Number.isFinite(listingTypeId)) {
    const { rows: tRows } = await pool.query(
      'SELECT type_id FROM listing WHERE id = $1 AND user_id = $2',
      [listingId, req.user.id]
    );
    if (!tRows.length) {
      return res.status(404).json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    }
    listingTypeId = Number(tRows[0].type_id);
  }

  let priceValue = null;
  if (hasPrice) {
    if (price === null || typeof price === 'undefined' || String(price).trim() === '') {
      priceValue = null;
    } else {
      const num = Number(String(price).replace(',', '.'));
      if (Number.isNaN(num)) {
        return res.status(400).json({ error: 'Nieprawidłowa cena' });
      }
      priceValue = num;
    }
  }

  const shouldForceFree = hasIsFree && isFreeValue === true;
  const finalHasPrice = listingTypeId === 1 && (hasPrice || shouldForceFree);
  const finalPriceValue = shouldForceFree ? 0 : priceValue;

  const finalHasIsFree = listingTypeId === 1 && hasIsFree;
  const finalIsFreeValue = isFreeValue;

  const finalHasNegotiable = listingTypeId === 1 && (hasNegotiable || shouldForceFree);
  const finalNegotiableValue = shouldForceFree ? false : negotiableValue;

  try {
    const result = await pool.query(
      `
      UPDATE listing
      SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        location       = COALESCE($3, location),
        item_condition = COALESCE($4, item_condition),
        category_id    = COALESCE($5, category_id),
        subcategory_id = COALESCE($6, subcategory_id),

        -- NOWE: edycja sprzedaży
        price          = CASE WHEN $9  THEN $10 ELSE price END,
        is_free        = CASE WHEN $11 THEN $12 ELSE is_free END,
        negotiable     = CASE WHEN $13 THEN $14 ELSE negotiable END

      WHERE id = $7::int AND user_id = $8::int
      RETURNING *
      `,
      [
        typeof title === 'undefined' ? null : title,
        typeof description === 'undefined' ? null : description,
        typeof location === 'undefined' ? null : location,
        condValue,
        catId,
        subId,
        listingId,
        req.user.id,
        finalHasPrice,
        finalPriceValue,
        finalHasIsFree,
        finalIsFreeValue,
        finalHasNegotiable,
        finalNegotiableValue,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    }

    res.json({ message: 'Ogłoszenie zaktualizowane', updated: result.rows[0] });
  } catch (err) {
    console.error('Błąd podczas edycji ogłoszenia', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});


// Symulacja zakupu ogłoszenia (BLIK)
router.post('/:id/purchase', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  const { blikCode } = req.body || {};

  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
  }

  if (!blikCode || !/^\d{6}$/.test(String(blikCode))) {
    return res.status(400).json({ error: 'Kod BLIK musi mieć dokładnie 6 cyfr' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, type_id, user_id, is_free FROM listing WHERE id = $1',
      [listingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
    }

    const listing = rows[0];

    if (listing.user_id === req.user.id) {
      return res.status(400).json({ error: 'Nie możesz kupić własnego ogłoszenia' });
    }

    if (listing.type_id !== 1) {
      return res.status(400).json({ error: 'To ogłoszenie nie jest ofertą sprzedaży' });
    }

    if (listing.is_free) {
      return res.status(400).json({ error: 'Ogłoszenie jest darmowe – nie wymaga płatności' });
    }

      // Ustawiamy status na "sprzedane"
      await pool.query(
         'UPDATE listing SET status_id = $1 WHERE id = $2',
        [SOLD_STATUS_ID, listingId]
      );
    
      return res.json({
        ok: true,
        message: 'Zakup udany'
      });    
  } catch (err) {
    console.error('Błąd przy symulacji zakupu:', err.message);
    return res.status(500).json({ error: 'Błąd serwera podczas zakupu' });
  }
});



router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.*,
        u.username AS author_username,
        u.avatar_url AS author_avatar_url,
        c.name     AS category_name,
        s.name     AS subcategory_name
      FROM listing l
      JOIN "user" u       ON u.id = l.user_id
      LEFT JOIN category c     ON c.id = l.category_id
      LEFT JOIN subcategory s  ON s.id = l.subcategory_id
      WHERE l.id = $1
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono ogłoszenia' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Błąd podczas pobierania szczegółów ogłoszenia:', err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/:id/images', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!listingId) {
      return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        COALESCE(
          path,
          'data:' || mime || ';base64,' || encode(data,'base64')
        ) AS path
      FROM listing_images
      WHERE listing_id = $1
      ORDER BY COALESCE(sort_order, id) ASC, id ASC
      `,
      [listingId]
    );

    const images = rows.map((r) => ({ id: r.id, path: r.path }));
    return res.json(images);
  } catch (err) {
    console.error('Błąd pobierania zdjęć ogłoszenia:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.patch('/:id/images/reorder', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const listingId = Number(req.params.id);
    const { orderedImageIds } = req.body || {};

    if (Number.isNaN(listingId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
    }

    if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
      return res.status(400).json({ error: 'orderedImageIds musi być niepustą tablicą ID zdjęć' });
    }

    // usuń duplikaty i znormalizuj do int
    const uniqueIds = Array.from(new Set(orderedImageIds.map((x) => Number(x)))).filter(
      (x) => Number.isFinite(x)
    );

    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: 'orderedImageIds nie zawiera poprawnych ID' });
    }

    // czy ogłoszenie jest użytkownika
    const check = await client.query(
      'SELECT id FROM listing WHERE id = $1 AND user_id = $2',
      [listingId, req.user.id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    }

    // pobierz wszystkie zdjęcia tego ogłoszenia
    const all = await client.query(
      'SELECT id FROM listing_images WHERE listing_id = $1 ORDER BY COALESCE(sort_order, id) ASC, id ASC',
      [listingId]
    );

    const allIds = all.rows.map((r) => r.id);

    // sprawdź, czy przekazane ID należą do ogłoszenia
    const allowed = new Set(allIds);
    for (const id of uniqueIds) {
      if (!allowed.has(id)) {
        return res.status(400).json({ error: 'Lista zawiera zdjęcia, które nie należą do tego ogłoszenia' });
      }
    }

    // final: najpierw te z payload, potem reszta (żeby zawsze mieć unikalne sort_order)
    const rest = allIds.filter((id) => !uniqueIds.includes(id));
    const finalIds = [...uniqueIds, ...rest];

    await client.query('BEGIN');

    // FAZA 1: ustaw tymczasowe, UNIKALNE sort_order (żeby nie było kolizji na UNIQUE(listing_id, sort_order)
    // nawet jeśli w bazie już istnieją duplikaty).
    await client.query(
      `WITH ordered AS (
         SELECT id,
                ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, id) ASC, id ASC) AS rn
         FROM listing_images
         WHERE listing_id = $1
       )
       UPDATE listing_images li
       SET sort_order = 100000 + o.rn
       FROM ordered o
       WHERE li.id = o.id AND li.listing_id = $1`,
      [listingId]
    );

    // FAZA 2: ustaw docelowe 0..n-1
    for (let i = 0; i < finalIds.length; i++) {
      await client.query(
        'UPDATE listing_images SET sort_order = $1 WHERE listing_id = $2 AND id = $3',
        [i, listingId, finalIds[i]]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('Błąd reorder zdjęć:', err.message);
    return res.status(500).json({ error: 'Błąd serwera', details: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id/images/:imageId', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const imageId   = Number(req.params.imageId);

    if (Number.isNaN(listingId) || Number.isNaN(imageId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID' });
    }

    // sprawdź, czy ogłoszenie jest tego użytkownika
    const check = await pool.query(
      'SELECT id FROM listing WHERE id = $1 AND user_id = $2',
      [listingId, req.user.id]
    );
    if (check.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Ogłoszenie nie istnieje lub nie należy do Ciebie' });
    }

    // pobierz ścieżkę pliku, jeśli jest
    const { rows } = await pool.query(
      'SELECT path FROM listing_images WHERE id = $1 AND listing_id = $2',
      [imageId, listingId]
    );

    // usuń rekord z bazy
    await pool.query(
      'DELETE FROM listing_images WHERE id = $1 AND listing_id = $2',
      [imageId, listingId]
    );

    // usuń fizyczny plik (jeśli jest path)
    if (rows[0]?.path) {
      const filePath = path.join(process.cwd(), 'backend', rows[0].path);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Błąd przy usuwaniu pliku:', err);
        });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Błąd usuwania zdjęcia:', err.message);
    return res.status(500).json({ error: 'Błąd serwera', details: err.message });
  }
});



let upload = null;
if (multer) {
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniq = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `listing-${uniq}${ext}`);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      cb(ok ? null : new Error('Invalid file type'), ok);
    }
  });
}

if (upload) {
  router.post('/:id/images', authRequired, upload.array('images', 6), async (req, res) => {
    try {
      const listingId = Number(req.params.id);
      if (!listingId) return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });

      const check = await pool.query('SELECT id FROM listing WHERE id=$1 AND user_id=$2', [listingId, req.user.id]);
      if (check.rowCount === 0) return res.status(404).json({ error: 'Ogłoszenie nie znalezione lub nie należy do Ciebie' });

      const files = req.files || [];
      if (files.length === 0) return res.status(400).json({ error: 'Nie przesłano żadnych plików' });

      // ustawiamy sort_order tak, aby nowe zdjęcia trafiały na koniec
      const { rows: maxRows } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM listing_images WHERE listing_id = $1',
        [listingId]
      );
      const startOrder = Number(maxRows?.[0]?.max_order ?? -1) + 1;

      const values = [];
      const placeholders = [];
      files.forEach((f, i) => {
        const relPath = `/uploads/${path.basename(f.path)}`;
        const fileBuf = fs.readFileSync(f.path);
        const sortOrder = startOrder + i;

        values.push(listingId, relPath, f.mimetype, f.size, fileBuf, sortOrder);
        const base = i * 6;
        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        );
      });

      await pool.query(
        `INSERT INTO listing_images (listing_id, path, mime, size, data, sort_order) VALUES ${placeholders.join(',')}`,
        values
      );

      return res.status(201).json({
        listingId,
        filesCount: files.length,
        files: files.map(f => ({
          path: `/uploads/${path.basename(f.path)}`,
          mime: f.mimetype,
          size: f.size
        }))
      });
    } catch (err) {
      console.error('Błąd podczas uploadu zdjęć:', err.message);
      return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
  });
}

router.patch('/:id/history', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE listing
       SET status_id = 4
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [listingId, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Nie znaleziono lub brak dostępu.' });
    }

    res.json({ ok: true, listing: rows[0] });
  } catch (err) {
    console.error('Błąd przenoszenia do historii:', err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

const HISTORY_STATUS_ID = 4;
const RESUME_COST_POINTS = 5;

// WZNÓW ogłoszenie z historii (koszt: 5 pkt)
router.patch('/:id/resume', authRequired, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID ogłoszenia' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) sprawdź czy ogłoszenie jest Twoje i w historii
    const lq = await client.query(
      'SELECT id, user_id, status_id FROM listing WHERE id = $1 FOR UPDATE',
      [listingId]
    );

    if (!lq.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nie znaleziono ogłoszenia' });
    }

    const listing = lq.rows[0];
    if (listing.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Brak dostępu' });
    }

    if (Number(listing.status_id) !== HISTORY_STATUS_ID) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'To ogłoszenie nie jest w historii' });
    }

    // 2) sprawdź punkty
    const uq = await client.query(
      'SELECT points FROM "user" WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );

    const points = Number(uq.rows[0]?.points ?? 0);
    if (points < RESUME_COST_POINTS) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Masz za mało punktów' });
    }

    // 3) odejmij punkty
    const up = await client.query(
      'UPDATE "user" SET points = points - $1 WHERE id = $2 RETURNING points',
      [RESUME_COST_POINTS, req.user.id]
    );

    // 4) ustaw ogłoszenie jako aktywne (dajemy NULL żeby było widoczne w /listings)
    const updated = await client.query(
      'UPDATE listing SET status_id = NULL WHERE id = $1 AND user_id = $2 RETURNING *',
      [listingId, req.user.id]
    );

    await client.query('COMMIT');
    return res.json({ ok: true, listing: updated.rows[0], points: up.rows[0].points });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Błąd wznowienia ogłoszenia:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});


module.exports = router;