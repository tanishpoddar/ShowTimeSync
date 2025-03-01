const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('movie_booking.db');

db.serialize(() => {
    db.run('DELETE FROM food_orders');
    db.run('DELETE FROM bookings');
    db.run('DELETE FROM seats');
    db.run('DELETE FROM food_items');
    db.run('DELETE FROM screens');
    db.run('DELETE FROM theaters');
    db.run('DELETE FROM waiting_list');
    db.run('DELETE FROM sqlite_sequence');
    db.run(`INSERT INTO theaters (name, location) VALUES 
        ('PVR Cinemas', 'Delhi'),
        ('PVR Cinemas', 'Mumbai')`);
    db.run(`INSERT INTO screens (theater_id, screen_type, total_seats, price) 
        SELECT id, 'Gold', 2, 400 FROM theaters WHERE location = 'Delhi'
        UNION ALL
        SELECT id, 'Max', 5, 300 FROM theaters WHERE location = 'Delhi'
        UNION ALL
        SELECT id, 'General', 10, 200 FROM theaters WHERE location = 'Delhi'
        UNION ALL
        SELECT id, 'Gold', 2, 400 FROM theaters WHERE location = 'Mumbai'
        UNION ALL
        SELECT id, 'Max', 5, 300 FROM theaters WHERE location = 'Mumbai'
        UNION ALL
        SELECT id, 'General', 10, 200 FROM theaters WHERE location = 'Mumbai'`);
    db.run(`INSERT INTO food_items (name, price) VALUES 
        ('Popcorn', 150),
        ('Sandwich', 100)`);
    db.all('SELECT id, total_seats FROM screens', [], (err, screens) => {
        if (err) {
            console.error('Error getting screens:', err);
            return;
        }
        screens.forEach(screen => {
            for (let i = 1; i <= screen.total_seats; i++) {
                db.run(
                    'INSERT INTO seats (screen_id, seat_number, is_booked) VALUES (?, ?, 0)',
                    [screen.id, `A${i}`]
                );
            }
        });
    });
});

console.log('Database cleaned and reinitialized');