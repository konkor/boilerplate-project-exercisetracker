require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
const cors = require('cors')

const mongoose = require("mongoose");

const mySecret = process.env['MONGO_URI']

let User;

mongoose.connect (mySecret, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [{
    description: { type: String, required: true },
    duration: { type: Number, default: 0 },
    date: { type: Date, default: Date.now }
  }]
});
//,  count: { type: Number, default: 0 }

User = mongoose.model ('User', userSchema);

// DB calls
//
const createAndSaveUser = (username, done) => {
  let user = new User ({ username: username });
  user.save ((err, data) => {
    if (err) {
      console.error (err);
      done (err);
    } else done (null, data);
  });
};

const queryUsers = (done) => {
  var querry = User.find ({}).select('_id username').exec ((err, data) => {
    if (err) {
      console.error (err);
      done (err);
    } else done (null, data);
  });
};

const addExercise = (userID, exercise, done) => {
  var user = User.findOne ({_id: userID}, (err, data) => {
    if (err) {
      console.log (err);
      done (err);
    } else {
      data.log.push (exercise);
      data.save ((err, data) => {
        if (err) {
          console.log (err);
          done (err);
        } else done (null, data);
      });
    }
  });
};

const getDateString = (text) => {
  return text.replaceAll ('\'', '').replaceAll ('\"', '');
};

const getLogs = (userID, from, to, limit, done) => {
  //console.log ('from to limit:', from, to, limit);
  limit = limit ? parseInt (limit) : null;
  from = from ? { $gte: ['$$item.date', {$toDate: getDateString (from)} ] } : true;
  to = to ? { $lte: ['$$item.date', {$toDate: getDateString (to)} ] } : true;
  filter = { $filter: {
    input: '$log',
    as: 'item',
    cond: {
      $and: [
        from,
        to
      ]
    }
  }};
  filter = limit ? { $slice: [ filter, limit ]} : filter;
  /*filter = { $map: { input: filter, as: 'el', in: {
    description: '$$el.description', duration: '$$el.duration', date: { $dateToString: { format: "%Y-%m-%d", date: "$$el.date" } }
  } } };
  */

  var user = User.aggregate ([
    { $match: {_id: mongoose.Types.ObjectId (userID) } },
    { $project: {
       _id: 1, username: 1, count: {$size: "$log"}, log: filter
    }}
  ], (err, data) => {
    if (err) {
      console.log (err);
      done (err);
    } else {
      done (null, data);
    }
  });

};


app.use (cors());
app.use(express.static('public'));
//console.log (__dirname, " - ", `${process.cwd()}/public`);
app.use ( bodyParser.urlencoded({extended: false}) );
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// API requests
//
app.post ('/api/users', function(req, res) {
  var new_user = req.body.username;

  if (!new_user || !new_user.trim().length) res.json ({ error: 'username required...' });
  new_user = new_user.trim();
  createAndSaveUser (new_user, (err, data) => {
    if (err) res.json ({ error: 'database failed...' });
    else {
      res.json ({ username: new_user, _id: data._id });
    }
  });
  console.log (new_user);
});

app.get ('/api/users', function(req, res) {
  queryUsers ((err, data) => {
    if (err) res.json ({ error: 'database failed...' });
    else {
      //console.log (data);
      res.json (data);
    }
  });
});

app.post ('/api/users/:_id/exercises', function(req, res) {
  let exercise = {
    description: req.body.description,
    duration: parseInt(req.body.duration),
    date: req.body.date || new Date()
  };
  addExercise (req.params._id, exercise, (err, data) => {
    if (err) res.json ({ error: 'database failed...' });
    else {
      //console.log (data);
      res.json ({
        _id: data._id, username: data.username,
        description: exercise.description, duration: exercise.duration, date: data.log[data.log.length-1].date.toDateString()
      });
    }
  });
});

app.get ('/api/users/:_id/logs', function(req, res) {
  getLogs (req.params._id, req.query.from, req.query.to, req.query.limit, (err, data) => {
    if (err) res.json ({ error: 'database failed...' });
    else {
      //console.log (data);
      if (data[0]) {
        data[0].log = data[0].log.map ( p => {
          return { description: p.description, duration: p.duration, date: p.date.toDateString() }
        });
        res.json (data[0]);
      } else res.json ({ error: 'no such user id...' });

    }
  });
});

/*app.get ('/name', (req, res) => {
  res.json( {name: req.query.first + ' ' + req.query.last} );
});*/



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
