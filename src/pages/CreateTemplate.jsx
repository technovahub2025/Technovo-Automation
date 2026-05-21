import React from 'react';
import { useLocation } from 'react-router-dom';
import WhatsAppTemplateCreator from '../components/WhatsAppTemplateCreator';
import './CreateTemplate.css';

const CreateTemplate = () => {
  const location = useLocation();
  const initialTemplate = location.state?.template || null;

  return (
    <div className="create-template-page">
      <WhatsAppTemplateCreator initialTemplate={initialTemplate} />
    </div>
  );
};

export default CreateTemplate;
