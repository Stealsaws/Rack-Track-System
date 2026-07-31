// ดึงมาจาก index.html จริง (normalizeDateStr, splitCsv, และ core logic ของ parseLocationCSV)
// แยกส่วนที่ไม่ผูกกับ DOM ออกมาเพื่อเทสได้อิสระ

function normalizeDateStr(s){
  if(!s)return{value:null,raw:''};
  const raw=String(s).trim();
  if(!raw)return{value:null,raw:''};
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)){const[y,mo,d]=raw.split('-');return{value:`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`,raw};}
  const m=raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){let[,d,mo,y]=m;if(y.length===2)y='20'+y;const dn=parseInt(d),mon=parseInt(mo);if(dn>=1&&dn<=31&&mon>=1&&mon<=12)return{value:`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`,raw};}
  return{value:null,raw};
}

function splitCsv(line){const res=[];let cur='',inQ=false;for(const ch of line){if(ch==='"'){inQ=!inQ;continue;}if(ch===','&&!inQ){res.push(cur.trim());cur='';continue;}cur+=ch;}res.push(cur.trim());return res;}

// core ของ parseLocationCSV แยกออกจาก DOM: รับ text คืนค่าเป็น {rows, badDateCount, error} แทนการยิงเข้า DOM ตรงๆ
function parseLocationCSVCore(text){
  text=text.replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
  if(lines.length<2)return{error:'ไฟล์ว่างเปล่า หรือมีแค่ header',rows:[],badDateCount:0};
  const headers=splitCsv(lines[0]).map(h=>h.toUpperCase().trim().replace(/['"]/g,''));
  const li=headers.findIndex(h=>['LOCATION','LOC','LOCATION_CODE','โลเคชั่น','ที่เก็บ'].some(k=>h.includes(k)));
  const si=headers.findIndex(h=>['SKU','BARCODE','PRODUCT CODE','PRODUCT_CODE','รหัส','CODE'].some(k=>h.includes(k)));
  const qi=headers.findIndex(h=>['QTY','QUANTITY','จำนวน','DEDUCT','STOCK','AMOUNT'].some(k=>h.includes(k)));
  const mi=headers.findIndex(h=>['MFD','วันผลิต','PRODUCTION','MFGDATE'].some(k=>h.includes(k)));
  const ei=headers.findIndex(h=>['EXP','EXPIRY','EXPIRE','EXPDATE','วันหมดอายุ','BEST'].some(k=>h.includes(k)));
  if(si===-1||qi===-1)return{error:`ไม่พบคอลัมน์ที่ต้องการ (SKU:${si} Qty:${qi})`,rows:[],badDateCount:0};
  const rows=[];let badDateCount=0;
  for(let i=1;i<lines.length;i++){
    const cols=splitCsv(lines[i]);
    const loc=String(cols[li]||'').trim().toUpperCase()||'PENDING';
    const sku=String(cols[si]||'').trim().toUpperCase();
    const qty=Math.round(parseFloat(String(cols[qi]||'0').replace(/,/g,''))||0);
    const mfdN=mi>=0?normalizeDateStr(cols[mi]):{value:null,raw:''};
    const expN=ei>=0?normalizeDateStr(cols[ei]):{value:null,raw:''};
    if(mfdN.raw&&!mfdN.value)badDateCount++;
    if(expN.raw&&!expN.value)badDateCount++;
    if(!sku)continue;
    rows.push({loc,sku,qty,mfd:mfdN.value,exp:expN.value,_mfdRaw:mfdN.raw,_expRaw:expN.raw});
  }
  return{error:null,rows,badDateCount};
}

// dedup logic เดียวกับที่ใช้ใน processLocationUpload (key = sku+loc+exp ตรงกับ DB unique constraint)
function dedupRows(rows){
  const map=new Map();
  rows.forEach(r=>{
    const k=`${r.sku}|${r.loc}|${r.exp||''}`;
    if(map.has(k)){const ex=map.get(k);ex.qty+=r.qty;if(r.mfd)ex.mfd=r.mfd;}
    else map.set(k,{...r});
  });
  return[...map.values()];
}

module.exports={normalizeDateStr,splitCsv,parseLocationCSVCore,dedupRows};
