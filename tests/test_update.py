import importlib.util
import unittest
import tempfile
import pathlib
import json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('updater','scripts/update.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)

def model(code='new-model'):
    return {'model':code,'name':'New','inference_metadata':{'response_modality':['Text']},'features':['function-calling'],'model_info':{'context_window':32768},'prices':[{'range_name':'Default','prices':[{'type':'input_token','price':'1','price_unit':'每百万tokens'},{'type':'output_token','price':'2','price_unit':'每百万tokens'}]}]}
class DataTests(unittest.TestCase):
    def test_catalog_pagination_discovers_new_ids(self):
        with patch.object(u,'get',side_effect=[{'success':True,'output':{'total':2,'models':[model('a')]}},{'success':True,'output':{'total':2,'models':[model('b')]}}]):
            rows,pages=u.fetch_catalog('https://example','key');self.assertEqual([r['model'] for r in rows],['a','b']);self.assertEqual(len(pages),2)
    def test_aa_pagination(self):
        with patch.object(u,'get',side_effect=[{'data':[{'id':'a'}],'pagination':{'has_more':True},'intelligence_index_version':4.3},{'data':[{'id':'b'}],'pagination':{'has_more':False},'intelligence_index_version':4.3}]):
            rows,_,version=u.fetch_aa('key');self.assertEqual(len(rows),2);self.assertEqual(version,4.3)
            self.assertEqual(u.get.call_args.args[2],{'page':2})
    def test_tiered_price_not_flattened(self):
        row=model();row['prices'][0]['range_name']='32k<Input<=128k';self.assertIsNone(u.simple_prices(row)['input'])
    def test_standard_task_selects_tier_and_preserves_unknown(self):
        row=model();row['prices'][0]['range_name']='0<Input<=32k'
        self.assertEqual(u.simple_prices(row),{'input':1,'output':2})
        row['prices'].append(dict(row['prices'][0]));self.assertIsNone(u.simple_prices(row)['input'])
        self.assertFalse(u.input_range_matches('32k<Input<=128k'))
        self.assertTrue(u.input_range_matches('Input<=10k'))
        self.assertFalse(u.input_range_matches('Input<10k'))
        self.assertTrue(u.input_range_matches('输入<=32k'))
        self.assertFalse(u.input_range_matches('256k<输入<=1m'))
    def test_legacy_endpoint_default(self):
        self.assertEqual(u.DEFAULT_CATALOG_URL,'https://dashscope.aliyuncs.com/api/v1/models')
    def test_exact_mapping_and_missing_metrics(self):
        aa={'id':'id','slug':'new-model','evaluations':{'artificial_analysis_intelligence_index':42,'artificial_analysis_coding_index':40},'performance':{'median_output_tokens_per_second':100}}
        result=u.build_models([model(),model('new-model-2027')],[aa],4.3,{},'now')
        self.assertEqual(result[0]['scores']['capability'],42);self.assertIsNone(result[0]['scores']['agentic']);self.assertEqual(result[0]['context_k'],32.768);self.assertIsNone(result[1]['provenance']['benchmark'])
    def test_ambiguous_slug_not_matched(self):
        self.assertIsNone(u.match_aa(model(),[{'slug':'new-model'},{'slug':'new-model'}],{}))
    def test_failure_preserves_published_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);(root/'data').mkdir();target=root/'data/models.json';target.write_text('{"existing":true}')
            with patch.object(u,'ROOT',root),patch.dict(u.os.environ,{'DASHSCOPE_API_KEY':'test'},clear=True),patch.object(u,'fetch_catalog',side_effect=ValueError('bad payload')),patch('builtins.print'):
                self.assertEqual(u.main(),1)
            self.assertEqual(json.loads(target.read_text()),{'existing':True})
            self.assertEqual(json.loads((root/'data/update-status.json').read_text())['status'],'failed')
    def test_partial_catalog_published_without_demo_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);(root/'config').mkdir();(root/'config/model-mappings.json').write_text('{}')
            with patch.object(u,'ROOT',root),patch.dict(u.os.environ,{'DASHSCOPE_API_KEY':'test'},clear=True),patch.object(u,'fetch_catalog',return_value=([model()],[])),patch('builtins.print'):
                self.assertEqual(u.main(),1)
            doc=json.loads((root/'data/models.json').read_text());self.assertTrue(doc['verified_catalog']);self.assertIsNone(doc['models'][0]['scores']['capability'])
            self.assertEqual(json.loads((root/'data/update-status.json').read_text())['status'],'partial')
    def test_no_benchmark_no_rank(self):
        models=u.build_models([model()],[],None,{},'now');roles=u.recommendations(models);self.assertTrue(all(not r['candidates'] for r in roles.values()))
if __name__=='__main__':unittest.main()

class PricingReleaseTests(unittest.TestCase):
    def test_time_bands_remain_separate(self):
        row=model();items=row['prices'][0]['prices'];row['prices'][0]['prices']=[dict(p,time_band=band,price=str(value)) for band,value in [('offpeak',0.5),('peak',2)] for p in items]
        result=u.parse_pricing(row)
        self.assertEqual(result['beijing'],{'input':2,'output':2})
        self.assertEqual([q['time_band'] for q in result['quotes']],['peak','offpeak'])
    def test_thinking_and_missing_zero(self):
        row=model()
        for p in row['prices'][0]['prices']:p['type']='thinking_'+p['type']
        self.assertEqual(u.parse_pricing(row)['comparison']['mode'],'thinking')
        row['prices'][0]['prices']=[{'type':'input_token','price':0,'price_unit':'每百万tokens'}]
        self.assertEqual(u.simple_prices(row),{'input':0,'output':None})
        self.assertEqual(u.parse_pricing(row)['status'],'incomplete')
        row['prices']=[];self.assertEqual(u.parse_pricing(row)['status'],'not-provided')
    def test_duplicate_unknown_band_and_invalid_date(self):
        row=model();row['prices'][0]['prices']*=2
        self.assertIsNone(u.simple_prices(row)['input'])
        row=model()
        for p in row['prices'][0]['prices']:p['time_band']='unknown'
        self.assertIsNone(u.simple_prices(row)['input'])
        self.assertEqual(u.public_release_date({'release_date':'2024-02-29'}),'2024-02-29')
        for value in ['2025-02-29','2026-01-01T00:00:00Z',None]:self.assertIsNone(u.public_release_date({'release_date':value}))
        row=model();row['published_time']='2024-01-01'
        self.assertEqual(u.build_models([row],[],None,{},'now')[0]['release_date_source'],'Bailian')

    def test_release_name_match_is_unique_and_does_not_change_benchmarks(self):
        row=model();row['published_time']='2024-03-01 12:00:00'
        aa={'name':'New','slug':'different','release_date':'2024-02-01'}
        self.assertEqual(u.release_metadata(row,None,[aa]),('2024-02-01','Artificial Analysis'))
        self.assertEqual(u.release_metadata(row,None,[aa,dict(aa,slug='other')]),('2024-03-01','Bailian'))
        self.assertIsNone(u.match_aa(row,[aa],{}))
        row['published_time']='invalid';self.assertEqual(u.release_metadata(row,None,[]),(None,None))
