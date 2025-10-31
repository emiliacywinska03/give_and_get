import Profile from './pages/Profile';
import ProtectedRoute from './auth/ProtectedRoute';
import React from "react";
import {Routes, Route} from 'react-router-dom'
import Footer from "./components/Footer";
import Header from "./components/Header";
import Main from "./components/Main"
import LoginRegiter from './pages/LoginRegister';
import CreateListing from './pages/CreateListing';
import ListingPage from "./pages/ListingPage";
import Favorites from './pages/Favorites';
import ListingDetails from './pages/ListingDetails';

function App() {
  return (
    <div>
      <Header />
      <Routes>
          <Route path="/" element={<Main />}/>
          <Route path="/auth" element={<LoginRegiter />}/>
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <Favorites />
            </ProtectedRoute>
          }
          />
          <Route path="/listings/create" element={<CreateListing/>} />
          <Route path="/listings" element={<ListingPage/>} />
          <Route path="/listing/:id" element={<ListingDetails />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
