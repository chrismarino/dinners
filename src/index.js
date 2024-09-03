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
        const [date, guests, guestNames] = line.split(',');
        return { date, guests, guestNames };
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
        return { name, email, invited: parseInt(invited), attended: parseInt(attended) };
      });
      res.json(guests);
    }
  });
});

app.get('/get-party-details', (req, res) => {
  const { date } = req.query;
  fs.readFile('parties.csv', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading parties.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      const party = data.trim().split('\n').find(line => line.startsWith(date));
      if (party) {
        const [date, guests, guestNames] = party.split(',');
        const guestNamesArray = guestNames.split(';');

        // Read guests.csv to get invited and attended counts
        fs.readFile('guests.csv', 'utf8', (err, guestData) => {
          if (err) {
            console.error('Error reading guests.csv', err);
            res.status(500).send('Internal Server Error');
          } else {
            const guests = guestData.trim().split('\n').map(line => {
              const [name, email, invited, attended] = line.split(',');
              return { name, invited: parseInt(invited), attended: parseInt(attended) };
            });

            const guestDetails = guestNamesArray.map(name => {
              const guest = guests.find(g => g.name === name);
              return {
                name,
                invited: guest ? guest.invited : 0,
                attended: guest ? guest.attended : 0
              };
            });

            res.json({ date, guests: guestDetails });
          }
        });
      } else {
        res.status(404).send('Party not found');
      }
    }
  });
});

app.post('/add-party', (req, res) => {
  const { date, guests } = req.body;
  const guestNames = guests.map(guest => guest.name).join(';');
  const csvLine = `${date},${guests.length},${guestNames}\n`;

  // Append to parties.csv
  fs.appendFile('parties.csv', csvLine, (err) => {
    if (err) {
      console.error('Error writing to parties.csv', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    // Read and update guests.csv
    fs.readFile('guests.csv', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading guests.csv', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      const selectedGuestNames = new Set(guests.map(guest => guest.name));

      const updatedGuests = data.trim().split('\n').map(line => {
        const [name, email, invited, attended] = line.split(',');
        if (selectedGuestNames.has(name)) {
          return `${name},${email},${parseInt(invited) + 1},${attended}`;
        }
        return line;
      }).join('\n');

      fs.writeFile('guests.csv', updatedGuests, (err) => {
        if (err) {
          console.error('Error writing to guests.csv', err);
          res.status(500).send('Internal Server Error');
        } else {
          res.status(200).send('Party added successfully');
        }
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});