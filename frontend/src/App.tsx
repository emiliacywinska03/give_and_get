import React from "react";
import {Routes, Route} from 'react-router-dom'
import Footer from "./components/Footer";
import Header from "./components/Header";
import Main from "./components/Main"
import LoginRegiter from './pages/LoginRegister';

function App() {
  return (
    <div>
      <Header />
      <Routes>
          <Route path="/" element={<Main />}/>
          <Route path="/auth" element={<LoginRegiter />}/>
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
