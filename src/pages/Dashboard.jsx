import React from 'react';

const Dashboard = () => {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <iframe
                src="https://nexion-ruby.vercel.app/"
                title="Nexion Dashboard"
                style={{
                    width: '100%',
                    height: '85vh',
                    border: 'none',
                    borderRadius: '12px', // Optional: adds a bit of polish matching the design system usually
                    backgroundColor: 'white'
                }}
            />
        </div>
    );
};

export default Dashboard;