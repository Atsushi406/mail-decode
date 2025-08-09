const { simpleParser } = require('mailparser');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  let rawB64 = '';
  try {
    rawB64 = req.body.rawEmail || req.body.raw;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  if (!rawB64) {
    res.status(400).json({ error: 'rawEmail (base64) is required' });
    return;
  }

  const buf = Buffer.from(rawB64, 'base64');

  try {
    const parsed = await simpleParser(buf);
    if (parsed && parsed.text) {
      res.status(200).json({
        charset_detected: (parsed.headers.get('content-type')?.params || {}).charset || null,
        subject: parsed.subject || null,
        from: parsed.from?.text || null,
        to: parsed.to?.text || null,
        body_utf8: parsed.text
      });
      return;
    }
  } catch (e) {
    console.error('mailparser error:', e.message);
  }

  const headerSample = buf.slice(0, 8192).toString('ascii');
  let charsetMatch = headerSample.match(/charset="?([A-Za-z0-9\-_]+)"?/i);
  let charset = charsetMatch ? charsetMatch[1] : null;

  if (!charset) {
    const guess = jschardet.detect(buf);
    charset = guess.encoding || 'UTF-8';
  }
  charset = charset.toUpperCase();

  let decoded;
  try {
    if (charset === 'UTF-8' || charset === 'US-ASCII') {
      decoded = buf.toString('utf8');
    } else {
      decoded = iconv.decode(buf, charset);
    }
  } catch (e) {
    decoded = buf.toString('utf8');
  }

  res.status(200).json({ charset_detected: charset, body_utf8: decoded });
};
