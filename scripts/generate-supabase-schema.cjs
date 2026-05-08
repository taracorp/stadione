const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'stadione.jsx');
const file = fs.readFileSync(filePath, 'utf8');
const names = ['VENUES','TOURNAMENTS','NEWS','COACHES','CHATS','BRACKETS','COACH_EXTRA'];
function extract(name){
  const re = new RegExp('const ' + name + '\\s*=\\s*([\\s\\S]*?);\\n(?=const|//|export|$)', 'm');
  const m = file.match(re);
  if(!m) throw new Error('missing '+name);
  return m[1];
}
function evaljs(text){
  return Function('return (' + text + ')')();
}
const data = {};
for(const name of names){
  const raw = extract(name);
  data[name] = evaljs(raw);
}
let sql = '';
const safe = v => v === null ? 'NULL' : typeof v === 'number' ? v : "'" + String(v).replace(/'/g, "''") + "'";
sql += "-- Stadione database schema and seed data\n";
sql += "CREATE TABLE venues (id integer primary key, name text not null, city text, sport text, price integer, rating numeric, reviews integer, color text);\n";
sql += "CREATE TABLE venue_tags (venue_id integer references venues(id), tag text not null, primary key (venue_id, tag));\n";
sql += "CREATE TABLE tournaments (id integer primary key, name text not null, sport text, format text, teams integer, status text, prize integer, start_date text, color text, host text, participants integer);\n";
sql += "CREATE TABLE tournament_standings (tournament_id integer references tournaments(id), pos integer, team text, p integer, w integer, d integer, l integer, gf integer, ga integer, pts integer, primary key (tournament_id, pos));\n";
sql += "CREATE TABLE tournament_schedule (tournament_id integer references tournaments(id), entry_id integer primary key, date text, home text, away text, score text, status text);\n";
sql += "CREATE TABLE tournament_bracket_rounds (id serial primary key, tournament_id integer references tournaments(id), round_order integer, name text);\n";
sql += "CREATE TABLE tournament_bracket_matches (id serial primary key, round_id integer references tournament_bracket_rounds(id), p1 text, p2 text, s1 integer, s2 integer, w integer);\n";
sql += "CREATE TABLE news (id integer primary key, category text, title text, excerpt text, author text, date text, read_time text, featured boolean, color text);\n";
sql += "CREATE TABLE coaches (id integer primary key, name text, sport text, exp integer, rating numeric, sessions integer, price integer, initial text);\n";
sql += "CREATE TABLE coach_certs (coach_id integer references coaches(id), cert text, primary key(coach_id, cert));\n";
sql += "CREATE TABLE coach_extra (coach_id integer primary key references coaches(id), bio text, location text);\n";
sql += "CREATE TABLE coach_languages (coach_id integer references coaches(id), language text, primary key(coach_id, language));\n";
sql += "CREATE TABLE coach_schedule (coach_id integer references coaches(id), schedule_line text, primary key(coach_id, schedule_line));\n";
sql += "CREATE TABLE coach_programs (coach_id integer references coaches(id), program_id integer, name text, price integer, duration text, description text, primary key(coach_id, program_id));\n";
sql += "CREATE TABLE chats (id integer primary key, coach_id integer references coaches(id), name text, sport text, initial text, online boolean, last_msg text, time text, unread integer);\n";
sql += "CREATE TABLE chat_messages (chat_id integer references chats(id), message_id integer, sender text, text text, time text, primary key(chat_id, message_id));\n";
sql += '\n-- Data inserts\n';
for(const v of data.VENUES){
  sql += `INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (${v.id},${safe(v.name)},${safe(v.city)},${safe(v.sport)},${v.price},${v.rating},${v.reviews},${safe(v.color)});\n`;
  for(const tag of v.tags){
    sql += `INSERT INTO venue_tags (venue_id,tag) VALUES (${v.id},${safe(tag)});\n`;
  }
}
for(const t of data.TOURNAMENTS){
  sql += `INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants) VALUES (${t.id},${safe(t.name)},${safe(t.sport)},${safe(t.format)},${t.teams},${safe(t.status)},${t.prize},${safe(t.startDate)},${safe(t.color)},${safe(t.host)},${t.participants});\n`;
  if(t.standings){
    for(const s of t.standings){
      sql += `INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (${t.id},${s.pos},${safe(s.team)},${s.p},${s.w},${s.d},${s.l},${s.gf},${s.ga},${s.pts});\n`;
    }
  }
  if(t.schedule){
    let idx=1;
    for(const s of t.schedule){
      sql += `INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (${t.id},${t.id*100+idx},${safe(s.date)},${safe(s.home)},${safe(s.away)},${safe(s.score||null)},${safe(s.status)});\n`;
      idx++;
    }
  }
}
for(const n of data.NEWS){
  sql += `INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (${n.id},${safe(n.category)},${safe(n.title)},${safe(n.excerpt)},${safe(n.author)},${safe(n.date)},${safe(n.read)},${n.featured ? 'true' : 'false'},${safe(n.color)});\n`;
}
for(const c of data.COACHES){
  sql += `INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (${c.id},${safe(c.name)},${safe(c.sport)},${c.exp},${c.rating},${c.sessions},${c.price},${safe(c.initial)});\n`;
  for(const cert of c.certs){
    sql += `INSERT INTO coach_certs (coach_id,cert) VALUES (${c.id},${safe(cert)});\n`;
  }
}
for(const coachId of Object.keys(data.COACH_EXTRA)){
  const extra = data.COACH_EXTRA[coachId];
  const id = Number(coachId);
  sql += `INSERT INTO coach_extra (coach_id,bio,location) VALUES (${id},${safe(extra.bio)},${safe(extra.location)});\n`;
  for(const lang of extra.languages){
    sql += `INSERT INTO coach_languages (coach_id,language) VALUES (${id},${safe(lang)});\n`;
  }
  for(const scheduleLine of extra.schedule){
    sql += `INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (${id},${safe(scheduleLine)});\n`;
  }
  let pid=1;
  for(const p of extra.programs){
    sql += `INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (${id},${pid},${safe(p.name)},${p.price},${safe(p.duration)},${safe(p.desc)});\n`;
    pid++;
  }
}
for(const chat of data.CHATS){
  sql += `INSERT INTO chats (id,coach_id,name,sport,initial,online,last_msg,time,unread) VALUES (${chat.id},${chat.coachId},${safe(chat.name)},${safe(chat.sport)},${safe(chat.initial)},${chat.online ? 'true':'false'},${safe(chat.lastMsg)},${safe(chat.time)},${chat.unread});\n`;
  let mid=1;
  for(const m of chat.messages){
    sql += `INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (${chat.id},${mid},${safe(m.from)},${safe(m.text)},${safe(m.time)});\n`;
    mid++;
  }
}
let roundGlobalId = 1;
for(const [tId, rounds] of Object.entries(data.BRACKETS)){
  for(let i=0;i<rounds.length;i++){
    const r = rounds[i];
    const rid = roundGlobalId++;
    sql += `INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (${tId},${i+1},${safe(r.name)});\n`;
    for(const match of r.matches){
      sql += `INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (${rid},${safe(match.p1)},${safe(match.p2)},${match.s1===null?'NULL':match.s1},${match.s2===null?'NULL':match.s2},${match.w===null?'NULL':match.w});\n`;
    }
  }
}
fs.writeFileSync(path.join(process.cwd(),'supabase-schema.sql'), sql);
console.log('supabase-schema.sql generated');
