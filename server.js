import { WebSocketServer } from "ws";

const port = Number(process.env.PORT || 8080);
const wss = new WebSocketServer({ port });
const rooms = new Map();

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function snapshot(room) {
  return [...room.values()].map(p => ({ id:p.id, name:p.name, lat:p.lat, lon:p.lon, at:p.at }));
}
function broadcast(room, msg, exceptId=null) {
  for (const p of room.values()) if (p.ws && p.id !== exceptId) send(p.ws, msg);
}

wss.on("connection", ws => {
  let currentRoom = null;
  let clientId = null;

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === "join") {
      const roomCode = String(m.room || "").toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(roomCode) || !m.id) return send(ws,{type:"error",message:"Invalid room code."});
      if (currentRoom) rooms.get(currentRoom)?.delete(clientId);
      currentRoom = roomCode; clientId = String(m.id).slice(0,100);
      if (!rooms.has(roomCode)) rooms.set(roomCode,new Map());
      const room=rooms.get(roomCode);
      room.set(clientId,{id:clientId,name:String(m.name||"JARVIS user").slice(0,40),ws});
      send(ws,{type:"snapshot",people:snapshot(room).filter(p=>p.id!==clientId)});
      broadcast(room,{type:"location",id:clientId,name:String(m.name||"JARVIS user").slice(0,40),at:Date.now()},clientId);
      return;
    }
    if (!currentRoom || !clientId) return;
    const room=rooms.get(currentRoom); const me=room?.get(clientId); if(!me) return;

    if (m.type === "location" && Number.isFinite(m.lat) && Number.isFinite(m.lon)) {
      me.lat=Number(m.lat); me.lon=Number(m.lon); me.at=Number(m.at)||Date.now(); me.name=String(m.name||me.name).slice(0,40);
      broadcast(room,{type:"location",id:clientId,name:me.name,lat:me.lat,lon:me.lon,at:me.at},clientId);
    } else if (m.type === "stop") {
      delete me.lat; delete me.lon; delete me.at;
      broadcast(room,{type:"stop",id:clientId},clientId);
    } else if (m.type === "leave") {
      room.delete(clientId); broadcast(room,{type:"left",id:clientId},clientId); if(room.size===0) rooms.delete(currentRoom); currentRoom=null; clientId=null;
    }
  });

  ws.on("close", () => {
    if (!currentRoom || !clientId) return;
    const room=rooms.get(currentRoom); if(!room) return;
    room.delete(clientId); broadcast(room,{type:"left",id:clientId},clientId); if(room.size===0) rooms.delete(currentRoom);
  });
});

console.log(`JARVIS private room server listening on port ${port}`);
