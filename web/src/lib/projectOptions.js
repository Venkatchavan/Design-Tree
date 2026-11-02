export const BASE_PROJECT_TYPES = ['Residential','Commercial','Industrial','Institutional','Healthcare','Hospitality','Retail','Mixed-use','Infrastructure','Interior'];
export function savedOptions(base, values=[]) {
 return [...new Set([...base,...values].filter(v=>v!==undefined&&v!==null&&String(v).trim()).map(String))].sort((a,b)=>a.localeCompare(b));
}
