const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /

    if (req.method === 'GET' && req.url === '/') {
      let htmlPage = fs.readFileSync("./views/new-player.html", "utf-8");
      let resBody = htmlPage.replace(/#{availableRooms}/g, world.availableRoomsToString());
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(resBody);
    }

    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === '/player') {

      let {name, roomId} = req.body;
      player = new Player(name, world.rooms[roomId]);

      res.setHeader('location', `/rooms/${roomId}`);
      res.statusCode = 302;
      return res.end();
    }

    //if no player has been created, send user home
    if (!player) {
      res.setHeader('location', '/');
      res.statusCode = 302;
      return res.end();
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && req.url.startsWith('/rooms/')) {
      let urlParts = req.url.split("/");
      if (urlParts.length  === 3) {
        let requestedRoom = world.rooms[urlParts[2]];

        //if wrong room
        if (requestedRoom !== player.currentRoom) {
          //find current room
          let correctRoomId;
          for (let room in world.rooms) {
            if (world.rooms[room].name === player.currentRoom.name) {
              correctRoomId = room;
            }
          }
          //redirect to correct room
          res.setHeader('location', `/rooms/${correctRoomId}`);
          res.statusCode = 302;
          return res.end();
        }

        let htmlPage = fs.readFileSync("./views/room.html", "utf-8");
        let resBody = htmlPage.replace(/#{roomName}/g, requestedRoom.name);
        resBody = resBody.replace(/#{inventory}/g, player.inventoryToString());
        resBody = resBody.replace(/#{roomItems}/g, requestedRoom.itemsToString());
        resBody = resBody.replace(/#{exits}/g, requestedRoom.exitsToString());
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        return res.end(resBody);
      }

    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && req.url.startsWith('/rooms/')) {
      let urlParts = req.url.split("/");

      if (urlParts.length === 4) {

        let currentRoom = world.rooms[urlParts[2]];

        //if wrong room
        if (currentRoom !== player.currentRoom) {
          //find current room
          let correctRoomId;
          for (let room in world.rooms) {
            if (world.rooms[room].name === player.currentRoom.name) {
              correctRoomId = room;
            }
          }
          //redirect to correct room
          res.setHeader('location', `/rooms/${correctRoomId}`);
          res.statusCode = 302;
          return res.end();
        }

        //if room is correct
        let direction = urlParts[3];
        player.move(direction[0]);

        //find id of  new room
        let newRoomId;
        for (let room in world.rooms) {
          if (world.rooms[room].name === player.currentRoom.name) {
            newRoomId = room;
          }
        }

        //redirect to new room
        res.setHeader('location', `/rooms/${newRoomId}`);
        res.statusCode = 302;
        return res.end();
      }

    }

    // Phase 5: POST /items/:itemId/:action

    if (req.method === 'POST' && req.url.startsWith('/items/')) {

      //get id of currentRoom
      let currentRoomId;
      for (let room in world.rooms) {
        if (world.rooms[room].name === player.currentRoom.name) {
          currentRoomId = room;
        }
      }

      let urlParts = req.url.split("/");
      let itemId = urlParts[2];
      let action = urlParts[3];

      switch(action) {
        case "take":
          player.takeItem(itemId);
          break;

        case "eat":
          try  {
            player.eatItem(itemId);
          } catch (error) {
            let htmlPage = fs.readFileSync("./views/error.html", "utf-8");
            let resBody = htmlPage.replace(/#{errorMessage}/g, error.message);
            resBody = resBody.replace(/#{roomId}/g, currentRoomId);
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/html");
            res.write(resBody);
          }

          res.end();
          break;

        case "drop":
          player.dropItem(itemId);
          break;
      }

      console.log(action);

      //redirect player to currentRoom


    }

    // Phase 6: Redirect if no matching route handlers
    let currentRoomId;
    for (let room in world.rooms) {
      if (world.rooms[room].name === player.currentRoom.name) {
        currentRoomId = room;
      }
    }

    res.setHeader('location', `/rooms/${currentRoomId}`);
    res.statusCode = 302;
    console.log('no matching handler');
    return res.end();
  })


});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
