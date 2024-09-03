const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/guests', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'guests.html'));
});

app.get('/parties', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'parties.html'));
});

app.get('/get-parties', (req, res) => {
  fs.readFile('parties.csv', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading parties.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      const parties = data.trim().split('\n').map(line => {
        const [date, guests] = line.split(',');
        return { date, guests };
      });
      res.json(parties);
    }
  });
});

app.get('/get-guests', (req, res) => {
  fs.readFile('guests.csv', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading guests.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      const guests = data.trim().split('\n').map(line => {
        const [name, email, invited, attended] = line.split(',');
        return { name, email, invited, attended };
      });
      res.json(guests);
    }
  });
});

app.post('/add-party', (req, res) => {
  const { date, guests } = req.body;
  const csvLine = `${date},${guests}\n`;
  fs.appendFile('parties.csv', csvLine, (err) => {
    if (err) {
      console.error('Error writing to parties.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.status(200).send('Party added successfully');
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});