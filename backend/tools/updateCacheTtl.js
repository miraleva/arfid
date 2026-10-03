const db = require('../db');

const twoDaysFromNow = Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60);

db.run(
  'UPDATE off_image_cache SET expires_at = ? WHERE expires_at > ?',
  [twoDaysFromNow, twoDaysFromNow],
  function(err) {
    if (err) {
      console.error('Error updating cache expires_at:', err.message);
      process.exit(1);
    }
    console.log('Successfully updated rows count:', this.changes);
    db.all(
      "SELECT query_term, expires_at, datetime(expires_at, 'unixepoch', 'localtime') as exp_human FROM off_image_cache LIMIT 5",
      (err2, rows) => {
        if (err2) {
          console.error(err2);
        } else {
          console.log('Sample updated rows:', rows);
        }
        process.exit(0);
      }
    );
  }
);
