import React, { useState } from 'react';
import SupportTicketForm from '../components/SupportTicketForm/SupportTicketForm';
import './SupportPage.css';

const SupportPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState(null);

  const handleSubmit = async (formData) => {
    // Simulate API call - replace with actual API call
    console.log('Submitting ticket:', formData);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock ticket ID
    const mockTicketId = `TKT-${Date.now()}`;
    setTicketId(mockTicketId);
    setSubmitted(true);
  };

  const handleNewTicket = () => {
    setSubmitted(false);
    setTicketId(null);
  };

  return (
    <div className="support-page">
      <div className="container">
        <div className="page-header">
          <h1>Support</h1>
          <p className="page-subtitle">We're here to help you</p>
        </div>

        {!submitted ? (
          <>
            <div className="support-info card">
              <h3>Before submitting a ticket...</h3>
              <ul>
                <li>Check our <a href="#faq">FAQ section</a> for common issues</li>
                <li>Make sure you're using the latest version</li>
                <li>Provide as much detail as possible</li>
                <li>Include any error messages you received</li>
              </ul>
            </div>

            <SupportTicketForm onSubmit={handleSubmit} />
          </>
        ) : (
          <div className="ticket-success card fade-in">
            <div className="success-icon">✓</div>
            <h2>Ticket Submitted Successfully!</h2>
            <p>Your ticket ID is: <strong>{ticketId}</strong></p>
            <p>We'll get back to you as soon as possible.</p>
            <p className="response-time">
              Average response time: <strong>24 hours</strong>
            </p>
            <button className="primary" onClick={handleNewTicket}>
              Submit Another Ticket
            </button>
          </div>
        )}

        <div className="faq-section" id="faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item card">
              <h4>How do I play the game?</h4>
              <p>Click on any empty cell to place your mark. Get three in a row to win!</p>
            </div>
            <div className="faq-item card">
              <h4>How is the leaderboard calculated?</h4>
              <p>Rankings are based on win percentage and total games played.</p>
            </div>
            <div className="faq-item card">
              <h4>Can I play with friends?</h4>
              <p>Yes! Share your game link with friends to play together.</p>
            </div>
            <div className="faq-item card">
              <h4>How do I reset my password?</h4>
              <p>Use the "Forgot Password" link on the login page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
