const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const loader = require('./load-ts.cjs');
const index = { version:'0123456789abcdef',rowCount:3,scales:['5000'],sheets:{'5022-1-0000':3} };
const record = (landNo,price,sourceRow=2) => ({reference:['5022','1','0000'],map4:'003',scale:'5000',landNo,price,sourceRow});
const nodes = value => !value || typeof value !== 'object' ? [] : [value,...(value.children||[]).flat(Infinity).flatMap(nodes)];
const text = value => value == null ? '' : typeof value !== 'object' ? String(value) : (value.children||[]).flat(Infinity).map(text).join('');
const deferred = () => { let resolve; const promise = new Promise(yes=>{resolve=yes;});return {promise,resolve}; };

function screen(loadSheet) {
  let cursor=0;const hooks=[],cleanups=[];
  const react = {
    createElement:(type,props,...children)=>({type,props:props||{},children}),
    useState:initial=>{const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;return [hooks[slot],next=>{hooks[slot]=typeof next==='function'?next(hooks[slot]):next;}];},
    useRef:initial=>{const slot=cursor++;return hooks[slot]||=( {current:initial} );},
    useMemo:callback=>{cursor++;return callback();},
    useEffect:callback=>{const slot=cursor++;if(!hooks[slot]){hooks[slot]=true;const cleanup=callback();if(cleanup)cleanups.push(cleanup);}},
  };
  const api=loader()('lib/songkhla-land.ts'),module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/components/tools/SongkhlaLandLookup.tsx'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React},
  }).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,React:react,AbortController,AbortSignal,setTimeout,clearTimeout,Intl,
    require:name=>{
      if(name==='react')return react;
      if(name==='lucide-react')return new Proxy({},{get:(_target,key)=>String(key)});
      if(name==='@/lib/songkhla-land')return {...api,loadLandSheet:loadSheet};
      throw new Error(name);
    },
  });
  const render=()=>{cursor=0;return module.exports.default({index});};
  return {render,unmount:()=>cleanups.forEach(cleanup=>cleanup()),sample:()=>nodes(render()).find(node=>node.type==='button'&&text(node)==='ลองกรอกตัวอย่าง').props.onClick(),
    submit:()=>nodes(render()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}}),
    change:(label,value)=>{const field=nodes(render()).find(node=>node.type==='label'&&text(node).startsWith(label));nodes(field).find(node=>['input','select'].includes(node.type)).props.onChange({target:{value}});},
  };
}

test('lookup waits for submit and conflicting rates require an explicit choice before calculating',async t=>{
  let calls=0;
  const page=screen(async()=>{calls++;return [record('422',450),record('422',900,3)];});t.after(page.unmount);
  assert.equal(calls,0);page.sample();assert.equal(calls,0);
  await page.submit();let tree=page.render();assert.equal(calls,1);
  assert.ok(text(tree).includes('พบหลายราคาสำหรับข้อมูลที่ค้นหา'));
  assert.ok(!nodes(tree).some(node=>node.props.id==='land-calculate-title'));
  nodes(tree).find(node=>node.type==='button'&&text(node).includes('900 บาท/ตร.ว.')).props.onClick();
  page.change('ไร่','1');tree=page.render();
  assert.ok(text(tree).includes('360,000 บาท'));
  page.change('เลขที่ดิน','110');tree=page.render();
  assert.ok(!text(tree).includes('360,000 บาท'));
  assert.ok(!nodes(tree).some(node=>node.props.id==='land-calculate-title'));
});

test('a delayed prior search cannot replace a newer result even when its adapter ignores abort',async t=>{
  const first=deferred(),second=deferred(),signals=[];
  const page=screen((_index,_key,signal)=>{signals.push(signal);return signals.length===1?first.promise:second.promise;});t.after(page.unmount);
  page.sample();const older=page.submit();page.change('เลขที่ดิน','110');const newer=page.submit();
  assert.equal(signals[0].aborted,true);
  second.resolve([record('110',250,4)]);await newer;
  assert.ok(text(page.render()).includes('250 บาท/ตร.ว.'));
  first.resolve([record('422',450)]);await older;
  const result=text(page.render());assert.ok(result.includes('250 บาท/ตร.ว.'));assert.ok(!result.includes('450 บาท/ตร.ว.'));
});

test('failed loads expose retry and never retain the previous calculated rate',async t=>{
  let fail=true;
  const page=screen(async()=>{if(fail)throw new Error('โหลดข้อมูลไม่สำเร็จ');return [record('422',450)];});t.after(page.unmount);
  page.sample();await page.submit();let tree=page.render();
  assert.ok(nodes(tree).some(node=>node.props.role==='alert'&&text(node).includes('โหลดข้อมูลไม่สำเร็จ')));
  assert.equal(nodes(tree).find(node=>node.type==='button'&&node.props.type==='submit').props.disabled,false);
  fail=false;await page.submit();tree=page.render();assert.ok(text(tree).includes('450 บาท/ตร.ว.'));
  assert.ok(!nodes(tree).some(node=>node.props.role==='alert'));
});
