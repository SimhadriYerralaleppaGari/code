import React, { useCallback, useEffect, useState } from 'react';
import Quill from 'quill';
import { io } from 'socket.io-client';
import 'quill/dist/quill.snow.css';
import './App.css';
import { jsPDF } from 'jspdf'; 

const SAVE_INTERVAL_MS = 2000;
const CURSOR_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

function App() {
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const s = io('http://localhost:4000');
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || !quill) return;

    socket.once('load-document', (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.on('receive-changes', (delta) => {
      quill.updateContents(delta);
    });

    socket.on('user-joined', ({ username, users }) => {
      setUsers(users);
    });

    socket.on('user-left', ({ username, users }) => {
      setUsers(users);
    });

    socket.on('cursor-move', ({ username, range }) => {
      const userIndex = users.findIndex((user) => user.username === username);
      const color = CURSOR_COLORS[userIndex % CURSOR_COLORS.length];
      updateCursor(username, range, color);
    });

    return () => {
      socket.off('receive-changes');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('cursor-move');
    };
  }, [socket, quill, users]);

  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socket.emit('send-changes', delta);
    };

    quill.on('text-change', handler);

    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit('save-document', { documentId, data: quill.getContents() });
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill, documentId]);

  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;

    wrapper.innerHTML = '';
    const editor = document.createElement('div');
    wrapper.appendChild(editor);
    const q = new Quill(editor, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
          [{ size: [] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'align': [] }],
          ['link', 'image'],
          ['clean']
        ],
        cursors: true
      }
    });
    q.disable();
    q.setText('Loading...');
    setQuill(q);

    q.on('selection-change', (range, oldRange, source) => {
      if (source === 'user' && range) {
        socket.emit('cursor-move', { username, range });
      }
    });
  }, [socket, username]);

  const updateCursor = (username, range, color) => {
    const cursorModule = quill.getModule('cursors');
    if (cursorModule) {
      cursorModule.createCursor(username, username, color);
      cursorModule.moveCursor(username, range);
    }
  };

  const handleJoin = () => {
    const enteredUsername = prompt('Enter your username:');
    if (enteredUsername) {
      setUsername(enteredUsername);
      setDocumentId(enteredUsername);
      socket.emit('join', { username: enteredUsername, documentId: enteredUsername });
    }
  };

  const handleCreateFile = () => {
    const newFileName = prompt('Enter a name for the new file:');
    if (newFileName && !files.includes(newFileName)) {
      setFiles([...files, newFileName]);
      setDocumentId(newFileName);
      socket.emit('create-document', newFileName);
      quill.setText('');
      quill.enable();
    }
  };

  const handleReadFile = (file) => {
    setDocumentId(file);
    socket.emit('join', { username, documentId: file });
  };

  const handleUpdateFile = () => {
    if (documentId) {
      socket.emit('send-changes', { documentId, data: quill.getContents() });
    }
  };

  const handleDeleteFile = () => {
    if (documentId && files.includes(documentId)) {
      const updatedFiles = files.filter((file) => file !== documentId);
      setFiles(updatedFiles);
      setDocumentId('');
      socket.emit('delete-document', documentId);
      quill.setText('');
    }
  };

  const handleDownloadPDF = () => {
    if (documentId && quill) {
      const doc = new jsPDF();
      const text = quill.getText();
      doc.text(text, 10, 10);
      doc.save(`${documentId}.pdf`);
    }
  };

  if (!socket) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <div className="header">Collaborative Document Editor</div>
      <div className="content">
        <div className="file-list">
          <h2>Files:</h2>
          <ul>
            {files.map((file) => (
              <li key={file}>
                <button onClick={() => handleReadFile(file)} className="file-button">{file}</button>
              </li>
            ))}
          </ul>
          <div className="file-actions">
            <button onClick={handleCreateFile} className="create-b">Create New File</button>
            <button onClick={handleDeleteFile} disabled={!documentId} className="delete-b">Delete Current File</button>
          </div>
        </div>
        <div className="quill-container" ref={wrapperRef}></div>
        <div className="user-list">
          <h3>Online Users:</h3>
          <ul>
            {users.map((user) => (
              <li key={user.username}>{user.username}</li>
            ))}
          </ul>
          {username && <div className="current-user">User: {username}</div>}
          {!username && <button onClick={handleJoin}>Join Collaboration</button>}
        </div>
      </div>
      {documentId && (
        <div className="save-options">
          <button onClick={handleUpdateFile}>Save Changes</button>
          <button onClick={handleDownloadPDF}>Download PDF</button>
        </div>
      )}
    </div>
  );
}

export default App;