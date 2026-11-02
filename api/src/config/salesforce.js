// Salesforce integration settings.
//
// Everything here is optional: when SF_CLIENT_ID / SF_CLIENT_SECRET are
// absent the integration is simply disabled and the API reports
// `configured: false`. Credentials live only on the server (api/.env or the
// deployment's secret store) and are never returned to the browser.
import './config.js';

function text(value) {
  return value == null ? '' : String(value).trim();
}

function baseUrl(value, fallback) {
  const raw = text(value) || fallback;
  return raw.replace(/\/+$/, '');
}

export function salesforceSettings() {
  const clientId = text(process.env.SF_CLIENT_ID);
  const clientSecret = text(process.env.SF_CLIENT_SECRET);
  const requestedObject = text(process.env.SF_PROJECT_OBJECT) || 'Project__c';
  // The object name is interpolated into SOQL, so only allow a safe identifier.
  const projectObject = /^[A-Za-z][A-Za-z0-9_]*$/.test(requestedObject)
    ? requestedObject
    : 'Project__c';

  return {
    configured: Boolean(clientId && clientSecret),
    loginUrl: baseUrl(process.env.SF_LOGIN_URL, 'https://login.salesforce.com'),
    clientId,
    clientSecret,
    apiVersion: text(process.env.SF_API_VERSION) || '68.0',
    projectObject,
  };
}
