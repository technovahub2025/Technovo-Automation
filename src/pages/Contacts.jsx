import React from 'react';
import { Search, UserPlus, Filter, MoreHorizontal } from 'lucide-react';
import './Contacts.css';

const Contacts = () => {
    return (
        <div className="contacts-page">
            <div className="page-header">
                <div>
                    <h2>Contacts</h2>
                    <p>Manage your customer database</p>
                </div>
                <div className="header-actions">
                    <button className="secondary-btn">Import</button>
                    <button className="primary-btn">
                        <UserPlus size={18} />
                        Add Contact
                    </button>
                </div>
            </div>

            <div className="contacts-controls">
                <div className="search-box">
                    <Search size={18} />
                    <input type="text" placeholder="Search contacts..." />
                </div>
                <button className="icon-btn"><Filter size={18} /></button>
            </div>

            <div className="contacts-table-container">
                <table className="contacts-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" /></th>
                            <th>Name</th>
                            <th>Phone Number</th>
                            <th>Tags</th>
                            <th>Status</th>
                            <th>Last Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input type="checkbox" /></td>
                            <td>Lyrisha</td>
                            <td>+91 (555) 123-4567</td>
                            <td><span className="tag blue">VIP</span></td>
                            <td><span className="badge active">Opted-in</span></td>
                            <td>2 mins ago</td>
                            <td><button className="action-btn"><MoreHorizontal size={16} /></button></td>
                        </tr>
                        <tr>
                            <td><input type="checkbox" /></td>
                            <td>Nandha</td>
                            <td>+91 (555) 987-6543</td>
                            <td><span className="tag gray">Lead</span></td>
                            <td><span className="badge active">Opted-in</span></td>
                            <td>1 hour ago</td>
                            <td><button className="action-btn"><MoreHorizontal size={16} /></button></td>
                        </tr>
                        <tr>
                            <td><input type="checkbox" /></td>
                            <td>Maaran</td>
                            <td>+91 (555) 456-7890</td>
                            <td><span className="tag red">Support</span></td>
                            <td><span className="badge inactive">Opted-out</span></td>
                            <td>2 days ago</td>
                            <td><button className="action-btn"><MoreHorizontal size={16} /></button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Contacts;
