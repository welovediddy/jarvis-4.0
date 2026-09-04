const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={get:(k,d)=>{try{return JSON.parse(localStorage.getItem("jarvis_"+k))??d}catch{return d}},set:(k,v)=>localStorage.setItem("jarvis_"+k,JSON.stringify(v))};
let tasks=store.get("tasks",[]), memories=store.get("memories",[]), friends=store.get("friends",[]), settings=store.get("settings",{accent:"#00d9ff",aiEndpoint:"",voiceRate:1,voiceStyle:"male",voiceName:"",speakAnswers:true,roomWsUrl:""});
let roomSocket=null, roomCodeActive="", roomPeople={}, locationWatchId=null, roomClientId=(globalThis.crypto?.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2));
document.documentElement.style.setProperty("--accent",settings.accent);

function dateGreeting(){const d=new Date(),day=d.toLocaleDateString(undefined,{weekday:"long"}),date=d.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});$("#today").textContent=day+" • "+date;$("#greeting").textContent=`Hello. Today is ${day}, ${date}. How can I assist you?`}
dateGreeting();

$$(".nav").forEach(b=>b.onclick=()=>{ $$(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".tab").forEach(x=>x.classList.remove("active"));$("#"+b.dataset.tab).classList.add("active")});
$$("[data-go]").forEach(b=>b.onclick=()=>{const n=b.dataset.go;document.querySelector(`[data-tab="${n}"]`).click()});

function renderTasks(){const el=$("#taskList"),today=$("#todayTasks");el.innerHTML="";today.innerHTML="";
tasks.forEach((t,i)=>{const row=document.createElement("div");row.className="item "+(t.done?"done":"");row.innerHTML=`<span>${esc(t.text)} ${t.time?`<small>• ${t.time}</small>`:""}</span><span><button onclick="toggleTask(${i})">✓</button><button onclick="deleteTask(${i})">×</button></span>`;el.append(row);
if(!t.done){const mini=row.cloneNode(true);mini.querySelectorAll("button").forEach(x=>x.remove());today.append(mini)}});if(!tasks.filter(t=>!t.done).length)today.innerHTML='<div class="muted">No open tasks. Enjoy your day.</div>';$("#taskCount").textContent=tasks.filter(t=>!t.done).length;store.set("tasks",tasks)}
window.toggleTask=i=>{tasks[i].done=!tasks[i].done;renderTasks()};window.deleteTask=i=>{tasks.splice(i,1);renderTasks()};
$("#addTask").onclick=()=>{const text=$("#taskInput").value.trim();if(!text)return;tasks.push({text,time:$("#taskTime").value,done:false});$("#taskInput").value="";$("#taskTime").value="";renderTasks()};

function renderMemories(){const q=$("#memorySearch").value.toLowerCase(),el=$("#memoryList");el.innerHTML="";memories.filter(x=>x.text.toLowerCase().includes(q)).forEach((m,i)=>{const row=document.createElement("div");row.className="item";row.innerHTML=`<span>${esc(m.text)}<br><small>${new Date(m.at).toLocaleString()}</small></span><button onclick="deleteMemory(${i})">Delete</button>`;el.append(row)});$("#memoryCount").textContent=memories.length;store.set("memories",memories)}
window.deleteMemory=i=>{memories.splice(i,1);renderMemories()};$("#saveMemory").onclick=()=>{const text=$("#memoryInput").value.trim();if(!text)return;memories.unshift({text:text.replace(/^remember( that)?/i,"").trim()||text,at:Date.now()});$("#memoryInput").value="";renderMemories()};$("#memorySearch").oninput=renderMemories;

function addChat(text,who="ai"){const row=document.createElement("div");row.className="msg "+who;row.textContent=text;$("#chat").append(row);$("#chat").scrollTop=$("#chat").scrollHeight;if(who==="ai"&&settings.speakAnswers)speakText(text)}
async function ask(){const q=$("#askInput").value.trim();if(!q)return;$("#askInput").value="";addChat(q,"user");
if(/^remember( that)?/i.test(q)){memories.unshift({text:q.replace(/^remember( that)?/i,"").trim(),at:Date.now()});renderMemories();addChat("Saved. I’ll keep that in this browser.");return}
if(/private room|location room|shared room/i.test(q)){document.querySelector('[data-tab="rooms"]').click();addChat("Opening the Private Location Room. You can create or join a room with a code.");return}
if(/create (a )?room|new room/i.test(q)){document.querySelector('[data-tab="rooms"]').click();setTimeout(()=>$("#createRoom")?.click(),0);return}
if(/join (the )?room/i.test(q)){document.querySelector('[data-tab="rooms"]').click();addChat("Enter the room code, then say or tap Join. I will not join a room without the code.");return}
if(/start (live )?location|share (my )?location/i.test(q)){document.querySelector('[data-tab="rooms"]').click();$("#shareLocation").checked=true;startLocationSharing();return}
if(/stop (live )?location|stop sharing/i.test(q)){$("#shareLocation").checked=false;stopLocationSharing();addChat("Location sharing stopped.");return}
if(/who( is| are)? in (the )?room|room members|show friends/i.test(q)){document.querySelector('[data-tab="rooms"]').click();renderRoomPeople();addChat(`${Object.keys(roomPeople).length} other people are currently visible in this room.`);return}
if(/how far|distance/i.test(q)){const vals=Object.values(roomPeople).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));if(!vals.length){addChat("No shared room locations are available yet.");return} if(!lastPosition){addChat("I need your location permission before I can calculate distances.");return} const lines=vals.map(x=>`${x.name}: ${formatDistance(distanceKm(lastPosition.lat,lastPosition.lon,x.lat,x.lon))}`);addChat(lines.join("\n"));return}
if(/what day|what's the date|today/i.test(q)){addChat(`Today is ${new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}.`);return}
if(settings.aiEndpoint){try{const r=await fetch(settings.aiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})});const data=await r.json();addChat(data.answer||data.message||"The AI server returned no answer.");return}catch(e){addChat("I couldn't reach the AI server, so I'm using my local fallback.");}}
addChat(localAnswer(q))}
function localAnswer(q){const s=q.toLowerCase();if(s.includes("task"))return"You can add tasks in Daily Tasks. I can also keep them in your browser between visits.";if(s.includes("weather"))return"Open Environment Monitor to check current weather and air quality for your location or a world location.";if(s.includes("location"))return"Use World Search or Nearby me. Your browser will ask permission before sharing your location.";if(s.includes("memory")||s.includes("remember"))return"Use Memory to save information intentionally, then search or delete it whenever you want.";return"I can help with world search, daily tasks, saved memory, weather/environment data and shared locations. For broad questions, connect a secure AI endpoint in Settings."}
$("#askBtn").onclick=ask;$("#askInput").onkeydown=e=>{if(e.key==="Enter")ask()};

let recognition;
let availableVoices=[];

function loadVoices(){
  if(!("speechSynthesis" in window)) return;
  availableVoices=speechSynthesis.getVoices();
  const select=$("#voiceName");
  if(!select) return;
  const current=settings.voiceName||"";
  select.innerHTML='<option value="">System default</option>';
  availableVoices.filter(v=>(v.lang||"").toLowerCase().startsWith((navigator.language||"en").split("-")[0].toLowerCase())).forEach(v=>{
    const opt=document.createElement("option");
    opt.value=v.name;
    opt.textContent=`${v.name} (${v.lang})`;
    select.append(opt);
  });
  if([...select.options].some(o=>o.value===current)) select.value=current;
}
if("speechSynthesis" in window){
  loadVoices();
  speechSynthesis.onvoiceschanged=loadVoices;
}

function pickVoice(){
  const wanted=(settings.voiceStyle||"male").toLowerCase();
  const lang=(navigator.language||"en").split("-")[0].toLowerCase();
  const voices=availableVoices.length?availableVoices:speechSynthesis.getVoices();
  if(settings.voiceName){
    const exact=voices.find(v=>v.name===settings.voiceName);
    if(exact) return exact;
  }
  const local=voices.filter(v=>(v.lang||"").toLowerCase().startsWith(lang));
  const pool=local.length?local:voices;
  const maleHints=["male","man","david","alex","daniel","fred","george","james","mark","thomas"];
  const femaleHints=["female","woman","samantha","victoria","zira","karen","moira","ava","allison"];
  const hints=wanted==="female"?femaleHints:maleHints;
  return pool.find(v=>hints.some(h=>(v.name||"").toLowerCase().includes(h)))||pool[0]||null;
}

function speakText(text){
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(String(text).slice(0,1800));
  const v=pickVoice();
  if(v) u.voice=v;
  u.rate=Number(settings.voiceRate)||1;
  u.pitch=(settings.voiceStyle||"male")==="female"?1.12:.88;
  speechSynthesis.speak(u);
}

$("#micBtn").onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){addChat("Voice input is not supported by this browser.");return}recognition=new SR();recognition.lang=navigator.language||"en-US";recognition.onresult=e=>{$("#askInput").value=e.results[0][0].transcript;ask()};recognition.start()};
$("#speakBtn").onclick=()=>speakText($("#greeting").textContent);

async function geocode(name){const u=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=en&format=json`;const r=await fetch(u);return (await r.json()).results||[]}
$("#worldBtn").onclick=async()=>{const q=$("#worldInput").value.trim();if(!q)return;$("#worldResults").innerHTML="Searching…";try{const rs=await geocode(q);$("#worldResults").innerHTML=rs.map(x=>`<div class="result"><strong>${esc(x.name)}</strong><span>${esc([x.admin1,x.country].filter(Boolean).join(", "))}</span><br><button onclick="openMap(${x.latitude},${x.longitude})">Open map</button><button onclick="loadEnv(${x.latitude},${x.longitude},'${esc(x.name)}')">Environment</button></div>`).join("")||"No locations found."}catch(e){$("#worldResults").textContent="Search failed. Check your connection."}};
window.openMap=(lat,lon)=>window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`,"_blank");

$$("[data-near]").forEach(b=>b.onclick=()=>{if(!navigator.geolocation){alert("Geolocation is not supported.");return}navigator.geolocation.getCurrentPosition(p=>window.open(`https://www.google.com/maps/search/${encodeURIComponent(b.dataset.near)}/@${p.coords.latitude},${p.coords.longitude},13z`,"_blank"),()=>alert("Location permission was not granted."))});

async function loadEnv(lat,lon,name="My location"){document.querySelector('[data-tab="environment"]').click();$("#envCards").innerHTML="<div class='card'>Loading…</div>";try{
const u=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`;
const a=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide&timezone=auto`;
const [w,air]=await Promise.all([fetch(u).then(r=>r.json()),fetch(a).then(r=>r.json())]);const c=w.current||{},aq=air.current||{};
$("#envCards").innerHTML=[["Place",name],["Temperature",`${c.temperature_2m??"—"} °C`],["Feels like",`${c.apparent_temperature??"—"} °C`],["Humidity",`${c.relative_humidity_2m??"—"}%`],["Wind",`${c.wind_speed_10m??"—"} km/h`],["UV",`${c.uv_index??"—"}`],["US AQI",aq.us_aqi??"—"],["PM2.5",`${aq.pm2_5??"—"} µg/m³`]].map(x=>`<div class="card stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
const d=w.daily;$("#forecast").innerHTML=d.time.slice(0,7).map((day,i)=>`<div class="day"><b>${new Date(day).toLocaleDateString(undefined,{weekday:"short"})}</b><br>${d.temperature_2m_min[i]}–${d.temperature_2m_max[i]} °C<br>UV max ${d.uv_index_max[i]}<br>Rain ${d.precipitation_probability_max[i]}%</div>`).join("");$("#envStatus").textContent="Loaded";
}catch(e){$("#envCards").innerHTML="<div class='card'>Environment data could not be loaded.</div>"}}
window.loadEnv=loadEnv;
$("#envBtn").onclick=async()=>{const q=$("#envInput").value.trim();if(q){const rs=await geocode(q);if(rs[0])loadEnv(rs[0].latitude,rs[0].longitude,[rs[0].name,rs[0].country].filter(Boolean).join(", "));else alert("Location not found.")}else if(navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>loadEnv(p.coords.latitude,p.coords.longitude),()=>alert("Location permission was not granted."))}else alert("Geolocation is not supported.")};

let cameraStream=null;
$("#startCamera").onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){$("#visionResult").textContent="Camera access is not supported by this browser.";return}
  try{
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    $("#camera").srcObject=cameraStream;
    $("#visionResult").textContent="Camera is live. Press “Capture & analyze” when you want JARVIS to inspect the scene.";
  }catch(e){
    $("#visionResult").textContent="Camera permission was not granted.";
  }
};
$("#stopCamera").onclick=()=>{
  if(cameraStream) cameraStream.getTracks().forEach(t=>t.stop());
  cameraStream=null;
  $("#camera").srcObject=null;
  $("#visionResult").textContent="Camera is off.";
};
$("#captureCamera").onclick=async()=>{
  if(!cameraStream){$("#visionResult").textContent="Start the camera first.";return}
  const video=$("#camera"),canvas=$("#cameraCanvas");
  if(!video.videoWidth){$("#visionResult").textContent="Camera is still starting. Try again in a moment.";return}
  canvas.width=Math.min(video.videoWidth,1280);
  canvas.height=Math.round(video.videoHeight*(canvas.width/video.videoWidth));
  const ctx=canvas.getContext("2d");
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const image=canvas.toDataURL("image/jpeg",.78);
  if(!settings.aiEndpoint){
    $("#visionResult").textContent="Captured locally. To have JARVIS actually describe objects, people, text or surroundings, add a vision-capable secure AI endpoint in Settings. The image was not uploaded.";
    return;
  }
  $("#visionResult").textContent="Analyzing the captured scene…";
  try{
    const r=await fetch(settings.aiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message:"Analyze this environment. Describe useful visible details such as general surroundings, objects, signs/text that are clearly readable, lighting and obvious environmental conditions. Do not identify people.",
      image,
      mode:"vision"
    })});
    const data=await r.json();
    const answer=data.answer||data.message||data.analysis;
    if(!answer) throw new Error("No analysis returned");
    $("#visionResult").textContent=answer;
    addChat(answer,"ai");
  }catch(e){
    $("#visionResult").textContent="The vision AI endpoint could not analyze the image. Check that your server accepts an image field and supports vision.";
  }
};

function renderFriends(){const el=$("#friendList");el.innerHTML="";friends.forEach((f,i)=>{const r=document.createElement("div");r.className="item";r.innerHTML=`<span><b>${esc(f.name)}</b><br><small>${f.lat}, ${f.lon}</small></span><span><button onclick="openMap(${f.lat},${f.lon})">Map</button><button onclick="deleteFriend(${i})">×</button></span>`;el.append(r)});store.set("friends",friends)}
window.deleteFriend=i=>{friends.splice(i,1);renderFriends()};$("#addFriend").onclick=()=>{const name=$("#friendName").value.trim(),lat=Number($("#friendLat").value),lon=Number($("#friendLon").value);if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)){alert("Enter a name and valid coordinates.");return}friends.push({name,lat,lon});$("#friendName").value=$("#friendLat").value=$("#friendLon").value="";renderFriends()};

$("#saveSettings").onclick=()=>{
  settings={
    accent:$("#accent").value,
    aiEndpoint:$("#aiEndpoint").value.trim(),
    roomWsUrl:$("#roomWsUrl").value.trim(),
    voiceRate:Number($("#voiceRate").value),
    voiceStyle:$("#voiceStyle").value,
    voiceName:$("#voiceName").value,
    speakAnswers:$("#speakAnswers").checked
  };
  store.set("settings",settings);
  document.documentElement.style.setProperty("--accent",settings.accent);
  loadVoices();
  alert("Settings saved.");
};
$("#accent").value=settings.accent;
$("#aiEndpoint").value=settings.aiEndpoint;
$("#roomWsUrl").value=settings.roomWsUrl||"";
$("#voiceRate").value=settings.voiceRate;
$("#voiceStyle").value=settings.voiceStyle||"male";
$("#speakAnswers").checked=settings.speakAnswers!==false;
loadVoices();
$("#clearData").onclick=()=>{if(confirm("Clear tasks, memories and shared locations?")){tasks=[];memories=[];friends=[];renderTasks();renderMemories();renderFriends()}};

// Private room location sharing. This is opt-in: each person must enable sharing.
let lastPosition=null;
function roomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="";if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(8);crypto.getRandomValues(a);for(let i=0;i<8;i++)out+=chars[a[i]%chars.length]}else{for(let i=0;i<8;i++)out+=chars[Math.floor(Math.random()*chars.length)]}return out}
function distanceKm(aLat,aLon,bLat,bLon){const R=6371,dLat=(bLat-aLat)*Math.PI/180,dLon=(bLon-aLon)*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function formatDistance(km){return km<1?`${Math.round(km*1000)} m`:`${km.toFixed(1)} km`}
function roomName(){return ($("#roomName").value.trim()||"JARVIS user").slice(0,40)}
function setRoomStatus(t){$("#roomStatus").textContent=t}
function renderRoomPeople(){const el=$("#roomPeople");if(!el)return;el.innerHTML="";const vals=Object.values(roomPeople);if(!vals.length){el.innerHTML='<div class="muted">No shared locations yet.</div>';return}vals.forEach(x=>{const row=document.createElement("div");row.className="item";let extra="";if(lastPosition&&Number.isFinite(x.lat)&&Number.isFinite(x.lon))extra=`<br><small>${formatDistance(distanceKm(lastPosition.lat,lastPosition.lon,x.lat,x.lon))} away • ${new Date(x.at||Date.now()).toLocaleTimeString()}</small>`;row.innerHTML=`<span><b>${esc(x.name||"Friend")}</b>${extra}</span><span class="status-dot">●</span>`;el.append(row)})}
function sendRoom(msg){if(roomSocket?.readyState===WebSocket.OPEN)roomSocket.send(JSON.stringify(msg))}
function connectRoom(){const code=$("#roomCode").value.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code)){alert("Use an 8-character room code.");return}if(!settings.roomWsUrl){setRoomStatus("Room code ready. To sync across devices, add the WebSocket room-server URL in Settings.");roomCodeActive=code;roomPeople={};renderRoomPeople();return}if(!("WebSocket" in window)){setRoomStatus("WebSocket is not supported by this browser.");return}if(roomSocket)roomSocket.close();roomCodeActive=code;roomPeople={};renderRoomPeople();setRoomStatus("Connecting to room server…");roomSocket=new WebSocket(settings.roomWsUrl);roomSocket.onopen=()=>{sendRoom({type:"join",room:code,name:roomName(),id:roomClientId});setRoomStatus(`Connected to room ${code}.`);if($("#shareLocation").checked)startLocationSharing()};roomSocket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==="snapshot"){roomPeople={};(m.people||[]).forEach(x=>{if(x.id!==roomClientId)roomPeople[x.id||x.name]=x});renderRoomPeople()}else if(m.type==="location"){if(m.id!==roomClientId)roomPeople[m.id||m.name]=m;renderRoomPeople()}else if(m.type==="left"){delete roomPeople[m.id];renderRoomPeople()}}catch{}};roomSocket.onerror=()=>setRoomStatus("Room server connection failed.");roomSocket.onclose=()=>{if(roomSocket){setRoomStatus("Room disconnected.");roomSocket=null}}}
function startLocationSharing(){if(!roomCodeActive){setRoomStatus("Create or join a room first.");$("#shareLocation").checked=false;return}if(!navigator.geolocation){setRoomStatus("Geolocation is not supported by this browser.");$("#shareLocation").checked=false;return}if(locationWatchId!==null)return;setRoomStatus("Location sharing is ON. You can turn it off at any time.");locationWatchId=navigator.geolocation.watchPosition(p=>{lastPosition={lat:p.coords.latitude,lon:p.coords.longitude,at:Date.now()};sendRoom({type:"location",id:roomClientId,name:roomName(),lat:lastPosition.lat,lon:lastPosition.lon,at:lastPosition.at});renderRoomPeople()},()=>setRoomStatus("Location permission was not granted."),{enableHighAccuracy:true,maximumAge:10000,timeout:15000})}
function stopLocationSharing(){if(locationWatchId!==null){navigator.geolocation.clearWatch(locationWatchId);locationWatchId=null}sendRoom({type:"stop",id:roomClientId});if(roomCodeActive)setRoomStatus(`Connected to room ${roomCodeActive}. Location sharing is OFF.`)}
$("#createRoom").onclick=()=>{$("#roomCode").value=roomCode();connectRoom();};
$("#joinRoom").onclick=connectRoom;
$("#copyRoom").onclick=async()=>{const c=$("#roomCode").value.trim();if(!c){addChat("There is no room code to copy yet.");return}try{await navigator.clipboard.writeText(c);addChat("Room code copied.")}catch{addChat(`Your room code is ${c}.`)}};
$("#leaveRoom").onclick=()=>{stopLocationSharing();sendRoom({type:"leave",id:roomClientId});roomSocket?.close();roomSocket=null;roomCodeActive="";roomPeople={};$("#shareLocation").checked=false;renderRoomPeople();setRoomStatus("No room connected.")};
$("#shareLocation").onchange=e=>e.target.checked?startLocationSharing():stopLocationSharing();


if(navigator.geolocation)$("#locationStatus").textContent="Available";
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
renderTasks();renderMemories();renderFriends();addChat("Systems online. I’m ready to help.");
