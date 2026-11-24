import React , { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MessageCircle, Send, LogOut, Search, UserRound, Wifi, WifiOff } from "lucide-react";
import { api, API_URL } from "./api";

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const { data } = await api.post(endpoint, form);
      onAuth(data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Check the backend.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark"><MessageCircle size={25} /></div>
        <p className="eyebrow">PULSE MESSENGER</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">Simple conversations, instantly connected.</p>
        {mode === "register" && <label>Username<input required minLength="2" maxLength="30" value={form.username} onChange={e => setForm({...form, username:e.target.value})} placeholder="Your name" /></label>}
        <label>Email address<input required type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="you@example.com" /></label>
        <label>Password<input required minLength="8" type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="At least 8 characters" /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="switch-auth">{mode === "login" ? "New to Pulse?" : "Already have an account?"}{" "}
          <button type="button" className="text-button" onClick={() => {setMode(mode === "login" ? "register" : "login");setError("");}}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState([]);
  const [search, setSearch] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("chat-token");
    if (!token) return;
    api.get("/auth/me")
      .then(({data}) => setAuth({ token, user: data.user }))
      .catch(() => localStorage.removeItem("chat-token"));
  }, []);

  useEffect(() => {
    if (!auth?.token) return;
    let active = true;
    api.get("/users").then(({data}) => { if (active) setUsers(data.users); })
      .catch(console.error);

    const socket = io(API_URL, { auth: { token: auth.token } });
    socketRef.current = socket;
    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", () => setSocketStatus("disconnected"));
    socket.on("onlineUsers", setOnline);
    socket.on("newMessage", message => {
      if (!active) return;
      const senderId = message.sender?._id || message.sender;
      const receiverId = message.receiver?._id || message.receiver;
      const otherId = senderId === auth.user._id ? receiverId : senderId;
      if (selectedRef.current?._id === otherId) {
        setMessages(prev => prev.some(m => m._id === message._id) ? prev : [...prev, message]);
      }
    });
    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth]);

  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    if (!auth || !selected) { setMessages([]); return; }
    api.get(`/messages/${selected._id}`)
      .then(({data}) => setMessages(data.messages))
      .catch(err => console.error(err));
  }, [auth, selected]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filteredUsers = useMemo(() => users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ), [users, search]);

  function handleAuth(data) {
    localStorage.setItem("chat-token", data.token);
    setAuth(data);
  }

  function logout() {
    socketRef.current?.disconnect();
    localStorage.removeItem("chat-token");
    setAuth(null); setSelected(null); setUsers([]); setMessages([]);
  }

  function sendMessage(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || !selected || !socketRef.current?.connected) return;
    setText("");
    socketRef.current.emit("sendMessage", { receiverId: selected._id, text: clean }, result => {
      if (result?.error) {
        setText(clean);
        window.alert(result.error);
      }
    });
  }

  if (!auth) return <AuthScreen onAuth={handleAuth} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="side-header">
          <div className="brand"><span className="brand-mark small"><MessageCircle size={19}/></span><div><strong>Pulse</strong><small>MESSENGER</small></div></div>
          <button className="icon-button" title="Log out" onClick={logout}><LogOut size={18}/></button>
        </div>
        <div className="profile-strip">
          <div className="avatar self"><UserRound size={19}/></div>
          <div className="profile-copy"><strong>{auth.user.username}</strong><span>Your account</span></div>
          <span className={`status-dot ${socketStatus === "connected" ? "online" : ""}`} title={socketStatus}/>
        </div>
        <div className="section-title"><span>MESSAGES</span><span>{users.length}</span></div>
        <div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." /></div>
        <div className="user-list">
          {filteredUsers.map(user => (
            <button key={user._id} className={`user-row ${selected?._id === user._id ? "active" : ""}`} onClick={() => setSelected(user)}>
              <div className="avatar">{user.username.slice(0,1).toUpperCase()}</div>
              <div className="user-copy"><strong>{user.username}</strong><span>{online.includes(user._id) ? "Online" : user.email}</span></div>
              <span className={`status-dot ${online.includes(user._id) ? "online" : ""}`}/>
            </button>
          ))}
          {filteredUsers.length === 0 && <p className="empty-users">No other users found yet.</p>}
        </div>
        <div className="sidebar-foot"><span className={`connection ${socketStatus}`} />{socketStatus === "connected" ? "Connected securely" : "Reconnecting..."}</div>
      </aside>

      <section className="chat-panel">
        {selected ? <>
          <header className="chat-header">
            <div className="avatar">{selected.username.slice(0,1).toUpperCase()}</div>
            <div><strong>{selected.username}</strong><span className="chat-presence">{online.includes(selected._id) ? "Active now" : "Offline"}</span></div>
          </header>
          <div className="messages-area">
            {messages.length === 0 ? <div className="empty-chat"><div className="empty-icon"><MessageCircle size={27}/></div><h2>Say hello to {selected.username}</h2><p>Your conversation starts here. Send the first message.</p></div> :
              messages.map(message => {
                const senderId = message.sender?._id || message.sender;
                const mine = senderId === auth.user._id;
                return <div key={message._id} className={`message-row ${mine ? "mine" : ""}`}>
                  <div className="bubble"><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div>
                </div>;
              })}
            <div ref={bottomRef}/>
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${selected.username}...`} maxLength="4000" />
            <button className="send-button" disabled={!text.trim() || socketStatus !== "connected"} aria-label="Send message"><Send size={18}/></button>
          </form>
        </> : <div className="welcome-panel"><div className="welcome-art"><MessageCircle size={42}/></div><h1>Your conversations, in real time.</h1><p>Select someone from the sidebar to start chatting.</p><div className="welcome-status">{socketStatus === "connected" ? <Wifi size={15}/> : <WifiOff size={15}/>} {socketStatus === "connected" ? "Live connection active" : "Waiting for connection"}</div></div>}
      </section>
    </main>
  );
}
