import crypto from 'node:crypto';
export const sha256Buffer=value=>crypto.createHash('sha256').update(value).digest('hex');
export const sha256Text=value=>sha256Buffer(Buffer.from(String(value),'utf8'));
export const stableId=(prefix,value)=>`${prefix}-${sha256Text(JSON.stringify(value,Object.keys(value||{}).sort())).slice(0,20)}`;
