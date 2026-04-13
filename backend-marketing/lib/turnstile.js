const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

async function verifyTurnstileToken({ token, remoteIp }) {
  if (!TURNSTILE_SECRET_KEY) {
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, message: 'Captcha requis' };
  }

  try {
    const formData = new URLSearchParams();
    formData.set('secret', TURNSTILE_SECRET_KEY);
    formData.set('response', token);
    if (remoteIp) formData.set('remoteip', remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { ok: false, message: 'Vérification captcha indisponible' };
    }

    const result = await response.json();
    if (!result?.success) {
      return { ok: false, message: 'Captcha invalide', codes: result?.['error-codes'] || [] };
    }

    return { ok: true };
  } catch (error) {
    console.warn('Turnstile verification failed:', error?.message || error);
    return { ok: false, message: 'Vérification captcha indisponible' };
  }
}

module.exports = { verifyTurnstileToken };
