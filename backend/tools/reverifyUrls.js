const https = require('https');
const { LOCAL_FOOD_IMAGES } = require('./data/localFoodImages');

async function verify(item) {
  return new Promise((resolve) => {
    const req = https.request(item.imageUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ name: item.name, status: res.statusCode, contentType: res.headers['content-type'], ok: res.statusCode === 200 });
    });
    req.on('error', (e) => resolve({ name: item.name, error: e.message, ok: false }));
    req.setTimeout(6000, () => { req.abort(); resolve({ name: item.name, timeout: true, ok: false }); });
    req.end();
  });
}

(async () => {
  console.log('Re-verifying all 22 URLs in localFoodImages.js...');
  const results = await Promise.all(LOCAL_FOOD_IMAGES.map(verify));
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.error('FAILED ITEMS:', failed);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 22/22 URLs verified with 200 OK!');
    results.forEach(r => console.log('✓ ' + r.name + ': ' + r.status + ' (' + r.contentType + ')'));
  }
})();
