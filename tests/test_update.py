import importlib.util
import unittest
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
    def test_tiered_price_not_flattened(self):
        row=model();row['prices'][0]['range_name']='32k<Input<=128k';self.assertIsNone(u.simple_prices(row)['input'])
    def test_standard_task_selects_tier_and_preserves_unknown(self):
        row=model();row['prices'][0]['range_name']='0<Input<=32k'
        self.assertEqual(u.simple_prices(row),{'input':1,'output':2})
        row['prices'].append(dict(row['prices'][0]));self.assertIsNone(u.simple_prices(row)['input'])
        self.assertFalse(u.input_range_matches('32k<Input<=128k'))
        self.assertTrue(u.input_range_matches('Input<=10k'))
        self.assertFalse(u.input_range_matches('Input<10k'))
    def test_legacy_endpoint_default(self):
        self.assertEqual(u.DEFAULT_CATALOG_URL,'https://dashscope.aliyuncs.com/api/v1/models')
    def test_exact_mapping_and_missing_metrics(self):
        aa={'id':'id','slug':'new-model','evaluations':{'artificial_analysis_intelligence_index':42,'artificial_analysis_coding_index':40},'performance':{'median_output_tokens_per_second':100}}
        result=u.build_models([model(),model('new-model-2027')],[aa],4.3,{},'now')
        self.assertEqual(result[0]['scores']['capability'],42);self.assertIsNone(result[0]['scores']['agentic']);self.assertEqual(result[0]['context_k'],32.768);self.assertIsNone(result[1]['provenance']['benchmark'])
    def test_ambiguous_slug_not_matched(self):
        self.assertIsNone(u.match_aa(model(),[{'slug':'new-model'},{'slug':'new-model'}],{}))
    def test_no_benchmark_no_rank(self):
        models=u.build_models([model()],[],None,{},'now');roles=u.recommendations(models);self.assertTrue(all(not r['candidates'] for r in roles.values()))
if __name__=='__main__':unittest.main()
