import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchPoems,matchesSearch} from '../core.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
test('搜尋繁簡、標點、跨行詩句與多關鍵字，保留正文',()=>{
 const before=JSON.stringify(poems);
 for(const q of ['靜夜思','静夜思','李白 静夜思','床前明月光疑是地上霜','床前明月光，疑是地上霜。'])assert.ok(searchPoems(poems,q).some(p=>p.id==='li-jing'),q);
 assert.ok(searchPoems(poems,'苏轼').some(p=>p.author==='蘇軾'));
 assert.ok(searchPoems(poems,'明月').length>1);
 assert.equal(searchPoems(poems,'不存在的作品xyz').length,0);
 assert.equal(searchPoems(poems,'').length,501);
 assert.ok(matchesSearch('明月幾時有？把酒問青天。','明月几时有把酒问青天'));
 assert.equal(JSON.stringify(poems),before);
});
