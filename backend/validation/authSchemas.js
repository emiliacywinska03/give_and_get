const { z } = require('zod');

const usernameRegex = /^[A-Za-z0-9._-]{3,30}$/; // litery/cyfry/myślnik/podkreślnik/kropka, 3-30
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/; // min 8 + duża/mała cyfra znak specialny

const registerSchema = z.object({
  username: z.string().trim().min(3, 'Wpisz nazwę użytkownika (3–30 znaków).')
    .max(30)
    .regex(usernameRegex, 'Wpisz nazwę z dozwolonymi znakami: litery, cyfry, kropka, podkreślnik, myślnik.'),
  email: z.string().trim().email('Wpisz poprawny e-mail.'),
  password: z.string()
    .min(8, 'Wpisz mocniejsze hasło: min. 8 znaków, mała/duzą litera, cyfra, symbol.')
    .regex(passwordRegex, 'Hasło musi mieć min. 8 znaków, dużą i małą literę, cyfrę i znak specjalny'),
  first_name: z.string().trim().min(1, 'Wpisz imię.').max(80),
  last_name: z.string().trim().min(1, 'Wpisz nazwisko.').max(80),
  security_question_id: z.coerce.number().int().positive('Wybierz pytanie.'),
  security_answer: z.string().trim().min(3, 'Wpisz odpowiedź (min. 3 znaki).').max(100, 'Wpisz krótszą odpowiedź (max 100 znaków).'),
});

const loginSchema = z.object({
  login: z.string().trim().min(3), // może być username LUB email
  password: z.string().min(1),
});

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
      return res.status(400).json({ ok: false, errors });
    }
    req.valid = parsed.data;
    next();
  };
}

module.exports = { registerSchema, loginSchema, validate };

