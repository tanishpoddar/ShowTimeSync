const { exec } = require('child_process');
const path = require('path');

export default function handler(req, res) {
  const initScriptPath = path.join(__dirname, '../scripts/init-db.js');
  exec(`node ${initScriptPath}`, (error, stdout, stderr) => {
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