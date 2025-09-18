import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div className="App">
          <header className="App-header">
            <div className="header-content">
              <h1>Document Extractor</h1>
              <div className="user-info">
                <span>Welcome, {user?.signInDetails?.loginId}</span>
                <button onClick={signOut} className="sign-out-btn">
                  Sign Out
                </button>
              </div>
            </div>
          </header>
          <main>
            <Dashboard user={user} />
          </main>
        </div>
      )}
    </Authenticator>
  );
}

export default App;
