const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const initSQL = fs.readFileSync('./init.sql', 'utf8');
const db = new sqlite3.Database('movie_booking.db');

db.serialize(() => {
    const statements = initSQL.split(';').filter(stmt => stmt.trim());
        statements.forEach(statement => {
        if (statement.trim()) {
            db.run(statement, err => {
                if (err) {
                    console.error('Error executing statement:', err);
                    console.error('Statement:', statement);
                }
            });
        }
    });

    db.all('SELECT id, total_seats FROM screens', [], (err, screens) => {
        if (err) {
            console.error('Error getting screens:', err);
            return;
        }
        screens.forEach(screen => {
            for (let i = 1; i <= screen.total_seats; i++) {
                db.run(
                    'INSERT INTO seats (screen_id, seat_number) VALUES (?, ?)',
                    [screen.id, `A${i}`],
                    err => {
                        if (err) {
                            console.error('Error inserting seat:', err);
                        }
                    }
                );
            }
        });
    });
});

console.log('Database initialization completed');