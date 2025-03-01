const { exec } = require('child_process');

export default function handler(req, res) {
  exec('node ./init-db.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      res.status(500).json({ message: 'Database initialization failed' });
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
    res.status(200).json({ message: 'Database initialized successfully' });
  });
}