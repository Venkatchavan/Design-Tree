// Project service enums and historical display labels resolve to the same
// meeting/chart services without changing the saved values.
const aliases = {str:'Structural',structural:'Structural',phe:'Plumbing',plumbing:'Plumbing',ele:'Electrical',elec:'Electrical',electrical:'Electrical',hvac:'Mechanical',mechanical:'Mechanical',fire:'Fire',bim:'BIM',gbs:'GBS','peer review':'Peer Review','mep coordination':'MEP Coordination'};
const bundles = {smep:['Structural','Mechanical','Electrical','Plumbing'],smepf:['Structural','Mechanical','Electrical','Plumbing','Fire'],mep:['Mechanical','Electrical','Plumbing']};
export function serviceNames(values=[]) {return [...new Set(values.flatMap(value=>{const key=String(value??'').trim().toLowerCase();return bundles[key]??[aliases[key]??String(value??'').trim()];}).filter(Boolean))];}
export function committedServiceNames(project) {return serviceNames([...(project?.services??[]),...(project?.scope??[]).map(row=>row.service??row)]);}
