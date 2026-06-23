const BASE32_ALPHABET='0123456789abcdefghjkmnpqrstvwxyz';

export function encodeCrockfordBase32(bytes:Uint8Array){let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=BASE32_ALPHABET[(value>>>(bits-5))&31];bits-=5;}}if(bits>0)result+=BASE32_ALPHABET[(value<<(5-bits))&31];return result;}

export function parseInboundReplyAddress(value:string,domain:string){
  const normalized=value.trim().toLowerCase();const escaped=domain.toLowerCase().replace(/^@/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=normalized.match(new RegExp(`^reply\\+(?:r2c-([0-9a-hjkmnp-tv-z]{26})|([a-f0-9]{64}))@${escaped}$`));
  return match?.[1]||match?.[2]||null;
}
