// Project service enums and historical display labels resolve to the same
// meeting/chart services without changing the saved values.
// 03 Nov 2026: Design Management and Design Coordination are one department,
// shown everywhere as "Design Management Coordination". Saved values are unchanged.
export const DESIGN_COORDINATION = 'Design Management Coordination';
const DESIGN_COORDINATION_ALIASES = Object.fromEntries(['design management','design mgmt','design coordination','coordination','design management coordination','design management & coordination','design management and coordination'].map(k=>[k,DESIGN_COORDINATION]));
export function departmentLabel(value) {const text=String(value??'').trim();return DESIGN_COORDINATION_ALIASES[text.toLowerCase()]??value;}
const aliases = {str:'Structural',structure:'Structural',structural:'Structural',phe:'Plumbing',plumbing:'Plumbing',ele:'Electrical',elec:'Electrical',electrical:'Electrical',hvac:'Mechanical',mechanical:'Mechanical',fire:'Fire','f&ls':'Fire','fire & life safety':'Fire',bim:'BIM','bim modeller':'BIM',gbs:'GBS','peer review':'Peer Review','mep coordination':'MEP Coordination',...DESIGN_COORDINATION_ALIASES};
const bundles = {smep:['Structural','Mechanical','Electrical','Plumbing'],smepf:['Structural','Mechanical','Electrical','Plumbing','Fire'],mep:['Mechanical','Electrical','Plumbing']};
export function serviceNames(values=[]) {return [...new Set(values.flatMap(value=>String(value??'').split(/\s*\+\s*/).flatMap(part=>{const key=part.trim().toLowerCase();return bundles[key]??[aliases[key]??part.trim()];})).filter(Boolean))];}
export function committedServiceNames(project) {return serviceNames([...(project?.services??[]),...(project?.scope??[]).map(row=>row.service??row)]);}
