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
        const [date, guests, guestDetails] = line.split(',');
        const guestDetailsArray = guestDetails.split(';');
        const totalAttended = guestDetailsArray.filter(detail => detail.split(':')[1] === 'true').length;
        return { date, guests: parseInt(guests), totalAttended };
      });
      res.json(parties);
    }
  });
});

app.get('/get-guests', (req, res) => {
  fs.readFile('guests.csv', 'utf8', (err, guestData) => {
    if (err) {
      console.error('Error reading guests.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      const guests = guestData.trim().split('\n').map(line => {
        const [name, email, invited, attended] = line.split(',');
        return { name, email, invited: parseInt(invited), attended: parseInt(attended) };
      });

      fs.readFile('parties.csv', 'utf8', (err, partyData) => {
        if (err) {
          console.error('Error reading parties.csv', err);
          res.status(500).send('Internal Server Error');
        } else {
          const partyLines = partyData.trim().split('\n');
          const attendanceCounts = {};

          partyLines.forEach(line => {
            const [date, guests, guestDetails] = line.split(',');
            guestDetails.split(';').forEach(detail => {
              const [name, attended] = detail.split(':');
              if (attended === 'true') {
                if (!attendanceCounts[name]) {
                  attendanceCounts[name] = 0;
                }
                attendanceCounts[name]++;
              }
            });
          });

          const updatedGuests = guests.map(guest => {
            return {
              ...guest,
              attended: attendanceCounts[guest.name] || 0
            };
          });

          res.json(updatedGuests);
        }
      });
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
        const [date, guests, guestDetails] = party.split(',');
        const guestDetailsArray = guestDetails.split(';').map(detail => {
          const [name, attended] = detail.split(':');
          return { name, attended: attended === 'true' };
        });

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

            const guestDetailsWithCounts = guestDetailsArray.map(detail => {
              const guest = guests.find(g => g.name === detail.name);
              return {
                ...detail,
                invited: guest ? guest.invited : 0,
                attendedCount: guest ? guest.attended : 0
              };
            });

            res.json({ date, guests: guestDetailsWithCounts });
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
  const guestDetails = guests.map(guest => `${guest.name}:${guest.attended}`).join(';');
  const csvLine = `${date},${guests.length},${guestDetails}\n`;

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
          const guest = guests.find(g => g.name === name);
          return `${name},${email},${parseInt(invited) + 1},${guest.attended ? parseInt(attended) + 1 : attended}`;
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

app.post('/update-attendance', (req, res) => {
  const { date, guestName, attended } = req.body;
  fs.readFile('parties.csv', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading parties.csv', err);
      res.status(500).send('Internal Server Error');
    } else {
      const parties = data.trim().split('\n').map(line => {
        const [partyDate, guests, guestDetails] = line.split(',');
        if (partyDate === date) {
          const updatedGuestDetails = guestDetails.split(';').map(detail => {
            const [name, currentAttended] = detail.split(':');
            if (name === guestName) {
              return `${name}:${attended}`;
            }
            return detail;
          }).join(';');
          return `${partyDate},${guests},${updatedGuestDetails}`;
        }
        return line;
      }).join('\n');

      fs.writeFile('parties.csv', parties, (err) => {
        if (err) {
          console.error('Error writing to parties.csv', err);
          res.status(500).send('Internal Server Error');
        } else {
          res.status(200).send('Attendance updated successfully');
        }
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});