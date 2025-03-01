const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3001;
const db = new sqlite3.Database('movie_booking.db');
app.use(express.json());
app.use(express.static('public'));

app.get('/api/theaters', (req, res) => {
    db.all('SELECT * FROM theaters', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/theaters/:theaterId/screens', (req, res) => {
    const theaterId = req.params.theaterId;
    db.all('SELECT * FROM screens WHERE theater_id = ?', [theaterId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/screens/:screenId/seats', (req, res) => {
    const screenId = req.params.screenId;
    db.all('SELECT * FROM seats WHERE screen_id = ?', [screenId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/food-items', (req, res) => {
    db.all('SELECT * FROM food_items', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/bookings', async (req, res) => {
    const { screenId, seatId, customerName, foodOrders, screenType } = req.body;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.get(
            `SELECT s.total_seats, 
                    (SELECT COUNT(*) FROM seats WHERE screen_id = ? AND is_booked = 1) as booked_seats
             FROM screens s 
             WHERE s.id = ?`,
            [screenId, screenId],
            (err, screenData) => {
                if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: err.message });
                    return;
                }
                if (screenData.booked_seats >= screenData.total_seats) {
                    db.run(
                        'INSERT INTO waiting_list (screen_id, customer_name, food_orders, status) VALUES (?, ?, ?, "waiting")',
                        [screenId, customerName, JSON.stringify(foodOrders)],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            db.get(
                                'SELECT COUNT(*) as position FROM waiting_list WHERE screen_id = ? AND status = "waiting"',
                                [screenId],
                                (err, result) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        res.status(500).json({ error: err.message });
                                        return;
                                    }
                                    db.run('COMMIT');
                                    res.json({
                                        success: true,
                                        isWaitingList: true,
                                        waitingListPosition: result.position,
                                        message: "Added to waiting list"
                                    });
                                }
                            );
                        }
                    );
                } else {     
                db.get('SELECT price FROM screens WHERE id = ?', [screenId], (err, screenData) => {
                    if (err) {
                        console.error('Error getting screen price:', err);
                        db.run('ROLLBACK');
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    console.log('Screen data:', screenData);
                    const screenPrice = screenData.price;
                    let bookingId;
                    db.run(
                        'INSERT INTO bookings (screen_id, seat_id, customer_name, total_amount) VALUES (?, ?, ?, ?)',
                        [screenId, seatId, customerName, screenPrice],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            bookingId = this.lastID;
                            db.run('UPDATE seats SET is_booked = 1 WHERE id = ?', [seatId]);
                            let foodTotal = 0;
                            const foodPromises = foodOrders.map(order => {
                                return new Promise((resolve, reject) => {
                                    const discount = screenType === 'Gold' ? 0.1 : 
                                                   screenType === 'Max' ? 0.05 : 0;
                                    const amount = order.price * order.quantity * (1 - discount);
                                    foodTotal += amount;
                                    db.run(
                                        'INSERT INTO food_orders (booking_id, food_item_id, quantity, amount) VALUES (?, ?, ?, ?)',
                                        [bookingId, order.foodItemId, order.quantity, amount],
                                        (err) => {
                                            if (err) reject(err);
                                            else resolve();
                                        }
                                    );
                                });
                            });
                            Promise.all(foodPromises)
                                .then(() => {
                                    db.run('COMMIT');
                                    res.json({
                                        success: true,
                                        bookingId,
                                        isWaitingList: false,
                                        totalAmount: screenPrice + foodTotal
                                    });
                                })
                                .catch(err => {
                                    db.run('ROLLBACK');
                                    res.status(500).json({ error: err.message });
                                });
                        }
                    );
                });
            }
        }
    );
});
});

app.delete('/api/bookings/:id', async (req, res) => {
    const bookingId = req.params.id;
    console.log('Processing cancellation for booking:', bookingId);

    try {
        const result = await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.get(
                    `SELECT b.*, s.screen_id, sc.screen_type, s.id as seat_id
                     FROM bookings b
                     JOIN seats s ON b.seat_id = s.id
                     JOIN screens sc ON s.screen_id = sc.id
                     WHERE b.id = ?`,
                    [bookingId],
                    (err, booking) => {
                        if (err) {
                            console.error('Error fetching booking:', err);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }

                        if (!booking) {
                            db.run('ROLLBACK');
                            reject(new Error('Booking not found'));
                            return;
                        }
                        db.run('UPDATE seats SET is_booked = 0 WHERE id = ?', 
                            [booking.seat_id], 
                            (err) => {
                                if (err) {
                                    console.error('Error updating seat:', err);
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                db.get(
                                    `SELECT * FROM waiting_list 
                                     WHERE screen_id = ? AND status = 'waiting'
                                     ORDER BY booking_date ASC LIMIT 1`,
                                    [booking.screen_id],
                                    (err, waitingBooking) => {
                                        if (err) {
                                            console.error('Error checking waiting list:', err);
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }
                                        if (waitingBooking) {
                                            console.log('Found waiting booking:', waitingBooking);
                                            const foodOrders = JSON.parse(waitingBooking.food_orders);
                                            db.run(
                                                `INSERT INTO bookings 
                                                 (screen_id, seat_id, customer_name, total_amount) 
                                                 VALUES (?, ?, ?, ?)`,
                                                [booking.screen_id, booking.seat_id, 
                                                 waitingBooking.customer_name, booking.total_amount],
                                                function(err) {
                                                    if (err) {
                                                        console.error('Error creating new booking:', err);
                                                        db.run('ROLLBACK');
                                                        reject(err);
                                                        return;
                                                    }
                                                    const newBookingId = this.lastID;
                                                    db.run(
                                                        'UPDATE seats SET is_booked = 1 WHERE id = ?', 
                                                        [booking.seat_id],
                                                        (err) => {
                                                            if (err) {
                                                                console.error('Error updating seat:', err);
                                                                db.run('ROLLBACK');
                                                                reject(err);
                                                                return;
                                                            }
                                                            db.run(
                                                                `UPDATE waiting_list 
                                                                 SET status = 'converted' 
                                                                 WHERE id = ?`,
                                                                [waitingBooking.id],
                                                                (err) => {
                                                                    if (err) {
                                                                        console.error('Error updating waiting list:', err);
                                                                        db.run('ROLLBACK');
                                                                        reject(err);
                                                                        return;
                                                                    }

                                                                    db.run('COMMIT');
                                                                    resolve({
                                                                        success: true,
                                                                        message: 'Booking cancelled and waiting list processed',
                                                                        waitingListProcessed: true,
                                                                        newBookingId
                                                                    });
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );
                                        } else {
                                            db.run('COMMIT');
                                            resolve({
                                                success: true,
                                                message: 'Booking cancelled',
                                                waitingListProcessed: false
                                            });
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
        res.json(result);

    } catch (error) {
        console.error('Error in cancellation process:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to process cancellation' 
        });
    }
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});