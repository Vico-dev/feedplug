"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Database, 
  Globe, 
  FileText, 
  Clock,
  type LucideIcon
} from "lucide-react";
import { CMSConnectors } from "@/components/cms-connectors";

type FlowType = 'ERP' | 'PIM' | 'CMS' | 'CSV';
type Schedule = 'manual' | 'hourly' | 'daily' | 'weekly';
type FlowConfigValue = string | boolean;
type FlowConfig = Record<string, FlowConfigValue>;
type FlowFieldOption = string | { value: string; label: string };

interface FlowField {
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'select' | 'checkbox';
  default?: boolean;
  options?: FlowFieldOption[];
}

interface FlowTypeDefinition {
  icon: LucideIcon;
  title: string;
  description: string;
  fields: Record<string, FlowField>;
}

interface FlowSubmitData {
  name: string;
  description: string;
  type: 'PRIMARY';
  flowType: FlowType;
  source: string;
  schedule: Schedule;
  config: FlowConfig;
}

interface CreateFlowFormProps {
  flowType: FlowType;
  onClose: () => void;
  onSubmit: (data: FlowSubmitData) => void;
}

export function CreateFlowForm({ flowType, onClose, onSubmit }: CreateFlowFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source: '',
    schedule: 'daily' as Schedule,
    config: {} as FlowConfig
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCMSConnector, setSelectedCMSConnector] = useState<string | null>(null);

  const flowTypeConfig: Record<FlowType, FlowTypeDefinition> = {
    ERP: {
      icon: Database,
      title: 'Connexion ERP',
      description: 'Connectez votre système ERP pour importer automatiquement votre catalogue',
      fields: {
        source: { label: 'URL de l\'API ERP', placeholder: 'https://api.erp.com/products' },
        username: { label: 'Nom d\'utilisateur', placeholder: 'votre_username' },
        password: { label: 'Mot de passe', placeholder: '••••••••', type: 'password' },
        apiKey: { label: 'Clé API (optionnel)', placeholder: 'votre_clé_api' }
      }
    },
    PIM: {
      icon: Database,
      title: 'Connexion PIM',
      description: 'Connectez votre système PIM pour synchroniser vos données produits',
      fields: {
        source: { label: 'URL de l\'API PIM', placeholder: 'https://api.pim.com/products' },
        username: { label: 'Nom d\'utilisateur', placeholder: 'votre_username' },
        password: { label: 'Mot de passe', placeholder: '••••••••', type: 'password' },
        apiKey: { label: 'Clé API (optionnel)', placeholder: 'votre_clé_api' }
      }
    },
    CMS: {
      icon: Globe,
      title: 'Connexion CMS',
      description: 'Connectez votre CMS pour importer vos contenus produits',
      fields: {
        platform: { 
          label: 'Plateforme CMS', 
          type: 'select', 
          options: [
            { value: 'wordpress', label: 'WordPress' },
            { value: 'shopify', label: 'Shopify' },
            { value: 'prestashop', label: 'PrestaShop' },
            { value: 'magento', label: 'Magento' },
            { value: 'woocommerce', label: 'WooCommerce' },
            { value: 'drupal', label: 'Drupal' },
            { value: 'joomla', label: 'Joomla' },
            { value: 'squarespace', label: 'Squarespace' },
            { value: 'wix', label: 'Wix' },
            { value: 'webflow', label: 'Webflow' },
            { value: 'strapi', label: 'Strapi' },
            { value: 'contentful', label: 'Contentful' },
            { value: 'sanity', label: 'Sanity' },
            { value: 'ghost', label: 'Ghost' },
            { value: 'other', label: 'Autre (API personnalisée)' }
          ]
        },
        source: { label: 'URL du site', placeholder: 'https://votre-site.com' },
        apiKey: { label: 'Clé API / Token', placeholder: 'votre_clé_api' },
        username: { label: 'Nom d\'utilisateur (si requis)', placeholder: 'votre_username' },
        password: { label: 'Mot de passe (si requis)', placeholder: '••••••••', type: 'password' }
      }
    },
    CSV: {
      icon: FileText,
      title: 'Import CSV',
      description: 'Importez votre catalogue via un fichier CSV',
      fields: {
        source: { label: 'Nom du fichier', placeholder: 'catalogue.csv' },
        delimiter: { label: 'Séparateur', placeholder: ',', type: 'select', options: [',', ';', '\t'] },
        encoding: { label: 'Encodage', placeholder: 'UTF-8', type: 'select', options: ['UTF-8', 'ISO-8859-1'] },
        hasHeader: { label: 'En-têtes', type: 'checkbox', default: true }
      }
    }
  };

  const config = flowTypeConfig[flowType];
  const IconComponent = config.icon;

  const handleInputChange = (field: string, value: FlowConfigValue) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleCMSConnectorSelect = (connectorId: string) => {
    setSelectedCMSConnector(connectorId);
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        platform: connectorId
      }
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom du flux est requis';
    }

    if (!formData.source.trim()) {
      newErrors.source = 'La source est requise';
    }

    if (flowType !== 'CSV') {
      if (!formData.config.username) {
        newErrors.username = 'Le nom d\'utilisateur est requis';
      }
      if (!formData.config.password) {
        newErrors.password = 'Le mot de passe est requis';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getOptionValue = (option: FlowFieldOption): string =>
    typeof option === 'string' ? option : option.value;

  const getOptionLabel = (option: FlowFieldOption): string =>
    typeof option === 'string' ? option : option.label;

  const getDefaultFieldValue = (field: FlowField): string => {
    const firstOption = field.options?.[0];
    return firstOption ? getOptionValue(firstOption) : '';
  };

  const getTextFieldValue = (fieldKey: string): string => {
    const value = formData.config[fieldKey];
    return typeof value === 'string' ? value : '';
  };

  const getCheckboxFieldValue = (fieldKey: string, field: FlowField): boolean =>
    typeof formData.config[fieldKey] === 'boolean'
      ? formData.config[fieldKey]
      : Boolean(field.default);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: FlowSubmitData = {
      name: formData.name,
      description: formData.description,
      type: 'PRIMARY',
      flowType: flowType,
      source: formData.source,
      schedule: formData.schedule,
      config: formData.config
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Header avec icône */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          backgroundColor: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          <IconComponent style={{ width: '24px', height: '24px' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
            {config.title}
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Informations générales */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          Informations générales
        </h4>
        
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Nom du flux *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Catalogue principal ERP"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.name ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = errors.name ? '#ef4444' : '#d1d5db'}
            />
            {errors.name && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du flux (optionnel)"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              {config.fields.source.label} *
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
              placeholder={config.fields.source.placeholder}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.source ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = errors.source ? '#ef4444' : '#d1d5db'}
            />
            {errors.source && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                {errors.source}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Configuration spécifique */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          Configuration {flowType}
        </h4>
        
        {flowType === 'CMS' && !selectedCMSConnector ? (
          <CMSConnectors onSelect={handleCMSConnectorSelect} />
        ) : flowType === 'CMS' && selectedCMSConnector ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Connecteur sélectionné
              </h5>
              <button
                type="button"
                onClick={() => setSelectedCMSConnector(null)}
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Changer de connecteur
              </button>
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              {Object.entries(config.fields).map(([key, field]: [string, FlowField]) => {
                if (key === 'source') return null; // Already handled above
                
                return (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      {field.label} {field.type !== 'checkbox' && '*'}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        value={typeof formData.config[key] === 'string' ? formData.config[key] : getDefaultFieldValue(field)}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: `1px solid ${errors[key] ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: 'white'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                        onBlur={(e) => e.target.style.borderColor = errors[key] ? '#ef4444' : '#d1d5db'}
                      >
                        {field.options?.map((option) => {
                          const value = getOptionValue(option);
                          const label = getOptionLabel(option);
                          return (
                            <option key={value} value={value}>{label}</option>
                          );
                        })}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={getCheckboxFieldValue(key, field)}
                          onChange={(e) => handleInputChange(key, e.target.checked)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '14px', color: '#374151' }}>
                          Le fichier contient des en-têtes
                        </span>
                      </div>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={getTextFieldValue(key)}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={field.placeholder}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: `1px solid ${errors[key] ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                        onBlur={(e) => e.target.style.borderColor = errors[key] ? '#ef4444' : '#d1d5db'}
                      />
                    )}
                    
                    {errors[key] && (
                      <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                        {errors[key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {Object.entries(config.fields).map(([key, field]: [string, FlowField]) => {
              if (key === 'source') return null; // Already handled above
              
              return (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    {field.label} {field.type !== 'checkbox' && '*'}
                  </label>
                  
                  {field.type === 'select' ? (
                    <select
                      value={typeof formData.config[key] === 'string' ? formData.config[key] : getDefaultFieldValue(field)}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: `1px solid ${errors[key] ? '#ef4444' : '#d1d5db'}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: 'white'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                      onBlur={(e) => e.target.style.borderColor = errors[key] ? '#ef4444' : '#d1d5db'}
                    >
                      {field.options?.map((option) => {
                        const value = getOptionValue(option);
                        const label = getOptionLabel(option);
                        return (
                          <option key={value} value={value}>{label}</option>
                        );
                      })}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={getCheckboxFieldValue(key, field)}
                        onChange={(e) => handleInputChange(key, e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        Le fichier contient des en-têtes
                      </span>
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={getTextFieldValue(key)}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: `1px solid ${errors[key] ? '#ef4444' : '#d1d5db'}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                      onBlur={(e) => e.target.style.borderColor = errors[key] ? '#ef4444' : '#d1d5db'}
                    />
                  )}
                  
                  {errors[key] && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                      {errors[key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Planification */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          <Clock style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
          Planification
        </h4>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {[
            { value: 'manual', label: 'Manuel', description: 'Import à la demande uniquement' },
            { value: 'hourly', label: 'Toutes les heures', description: 'Import automatique chaque heure' },
            { value: 'daily', label: 'Quotidien', description: 'Import automatique chaque jour à 2h' },
            { value: 'weekly', label: 'Hebdomadaire', description: 'Import automatique chaque lundi à 2h' }
          ].map(option => (
            <label key={option.value} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px',
              border: `1px solid ${formData.schedule === option.value ? '#2563eb' : '#e5e7eb'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: formData.schedule === option.value ? '#eff6ff' : 'white'
            }}>
              <input
                type="radio"
                name="schedule"
                value={option.value}
                checked={formData.schedule === option.value}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value as Schedule }))}
                style={{ width: '16px', height: '16px' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {option.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          style={{ border: '1px solid #d1d5db', color: '#374151' }}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          style={{ backgroundColor: '#2563eb', color: 'white', border: 'none' }}
        >
          Créer le flux
        </Button>
      </div>
    </form>
  );
}


