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
    def test_variant_reference_is_unique_same_generation_and_separate_date_speed(self):
        row=model('example-3.8-flash')
        row['published_time']='2026-08-25 00:00:00'
        aa={'id':'variant','name':'Example 3.8 Flash Next','slug':'example-3-8-flash-next','evaluations':{'artificial_analysis_intelligence_index':40},'performance':{'median_output_tokens_per_second':100},'release_date':'2026-09-01'}
        result=u.build_models([row],[aa],4.3,{},'now')[0]
        self.assertEqual(result['scores']['capability'],40)
        self.assertEqual(result['release_date'],'2026-08-25')
        self.assertEqual(result['release_date_source'],'Bailian')
        self.assertIsNone(result['speed']['tokens_per_second'])
        self.assertEqual(result['provenance']['benchmark']['match_method'],'same-version-variant-reference')
        self.assertIsNone(u.variant_reference(model('example-3.7-flash'),[aa]))
        self.assertIsNone(u.variant_reference(row,[aa,dict(aa,id='duplicate')]))
        exact=dict(aa,id='exact',slug='example-3-8-flash')
        self.assertEqual(u.build_models([row],[aa,exact],4.3,{},'now')[0]['provenance']['benchmark']['aa_id'],'exact')

    def test_prime_requires_provider_confirmation_and_keeps_speed_separate(self):
        aa={'id':'base','slug':'glm-5-3','evaluations':{'artificial_analysis_intelligence_index':44.8,'artificial_analysis_coding_index':74.8},'performance':{'median_output_tokens_per_second':77},'release_date':'2026-08-18'}
        row=model('glm-5.3-prime')
        self.assertIsNone(u.match_aa(row,[aa],{}))
        row['description']='GLM-5.3-Prime 是 GLM-5.3 的高速版本'
        row['published_time']='2026-09-21 13:35:15'
        result=u.build_models([row],[aa],4.3,{},'now')[0]
        self.assertEqual(result['scores']['coding'],74.8)
        self.assertIsNone(result['speed']['tokens_per_second'])
        self.assertEqual(result['release_date_source'],'Bailian')
        self.assertEqual(result['provenance']['benchmark']['match_method'],'provider-confirmed-base-reference')
        self.assertIn('基础模型',result['missing_reasons']['speed'])
        self.assertIn('接口未提供',result['missing_reasons']['agentic'])
        self.assertIsNone(u.match_aa(row,[aa,dict(aa,id='duplicate')],{}))
        row['model']='glm-5.4-prime'
        self.assertIsNone(u.match_aa(row,[aa],{}))

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
        self.assertEqual(u.match_aa(row,[aa],{}),aa)
        self.assertIsNone(u.match_aa(row,[aa,dict(aa,slug='other')],{}))
        row['published_time']='invalid';self.assertEqual(u.release_metadata(row,None,[]),(None,None))

    def test_name_match_keeps_versions_and_reasoning_distinct(self):
        row=model('qwen3.6-max-preview');row['name']='Qwen3.6-Max-Preview'
        aa={'id':'correct','slug':'qwen3-6-max','name':'Qwen3.6 Max Preview'}
        self.assertEqual(u.match_aa(row,[aa,{'id':'wrong','slug':'qwen3-7-max','name':'Qwen3.7 Max Preview'}],{}),aa)
        row['name']='Qwen3.6 Max Thinking'
        row['model']='qwen3.6-max-thinking'
        self.assertIsNone(u.match_aa(row,[aa],{}))

class IdentityTests(unittest.TestCase):
    def test_snapshot_in_display_name_and_effort_do_not_collide(self):
        aa = {'id':'default','slug':'nova-4-flash','name':'Nova 4 Flash 0731 (Max)'}
        other = {'id':'other','slug':'nova-4-flash-non-reasoning','name':'Nova 4 Flash 0731 (Non-reasoning)'}
        self.assertEqual(u.match_aa(model('nova-4-flash-0731'),[aa,other]),aa)
        self.assertIsNone(u.match_aa(model('nova-4-flash-0813'),[aa,other]))
        dated = {'id':'dated','slug':'nova-5-max','name':'Nova 5 Max (0902)'}
        self.assertEqual(u.match_aa(model('nova-5-max-0902'),[dated]),dated)
        self.assertIsNone(u.match_aa(model('nova-5-max-0902'),[dated,dict(dated,id='duplicate')]))

    def test_reasoning_synonym_preserves_size_and_version(self):
        aa = {'slug':'nova-4-80b-reasoning','name':'Nova 4 80B (Reasoning)'}
        self.assertEqual(u.match_aa(model('nova-4-80b-thinking'),[aa]),aa)
        for code in ('nova-4-8b-thinking','nova-5-80b-thinking','nova-4-80b-low'):
            self.assertIsNone(u.match_aa(model(code),[aa]))

    def test_similarity_is_review_only_and_mappings_are_not_used(self):
        aa = {'id':'one','slug':'nova-4-flash-turbo','name':'Nova 4 Flash Turbo'}
        row = model('nova-4-flash')
        self.assertIsNone(u.match_aa(row,[aa],{'nova-4-flash':{'aa_id':'one'}}))
        models = u.build_models([row],[aa],4.3,{},'now')
        audit = u.matching_audit(models,[row],[aa])
        self.assertEqual(audit['entries'][0]['status'],'review-required')
        self.assertTrue(audit['entries'][0]['candidates'])

    def test_provider_reference_works_for_other_speed_suffixes(self):
        row = model('nova-5-fast-preview');row['description']='Nova-5-Fast-Preview 是 Nova-5 的高速版本'
        aa = {'id':'base','slug':'nova-5','evaluations':{'artificial_analysis_intelligence_index':30},'performance':{'median_output_tokens_per_second':10}}
        result = u.build_models([row],[aa],4.3,{},'now')[0]
        self.assertEqual(result['scores']['capability'],30)
        self.assertIsNone(result['speed']['tokens_per_second'])
        self.assertEqual(result['provenance']['benchmark']['reference_model'],'nova-5')

    def test_duplicate_benchmarks_do_not_move_tiers(self):
        aa = [{'id':str(i),'slug':f'nova-{i}','evaluations':{'artificial_analysis_intelligence_index':40-i}} for i in range(4)]
        rows = [model(f'nova-{i}') for i in range(4)]
        anchors=[{'id':'official','slug':'claude-fable-9','name':'Claude Fable 9','release_date':'2026-01-01','model_creator':{'name':'Anthropic'},'evaluations':{'artificial_analysis_intelligence_index':40}}]
        original = u.recommendations(u.build_models(rows,aa,4.3,{},'now'),anchors)
        duplicate = model('nova-0-prime');duplicate['description']='Nova-0-Prime 是 Nova-0 的高速版本'
        result = u.recommendations(u.build_models(rows+[duplicate],aa,4.3,{},'now'),anchors)
        for key in original:
            self.assertEqual([c for c in result[key]['candidates'] if c != 'nova-0-prime'],original[key]['candidates'])

class ReferenceTierTests(unittest.TestCase):
    def anchor(self,role,score,date='2026-09-01',creator='Anthropic',suffix=''):
        return {'id':role+suffix,'slug':'official-'+role+'-9'+suffix,'name':'Official '+role+' 9','release_date':date,'model_creator':{'name':creator},'evaluations':{'artificial_analysis_intelligence_index':score}}

    def test_latest_headline_variant_not_best_score_or_older_model(self):
        old=self.anchor('fable',90,'2025-01-01')
        new=self.anchor('fable',50)
        high=self.anchor('fable',80,suffix='-high')
        self.assertEqual(u.reference_model([old,new,high],'Anthropic','fable'),new)
        self.assertEqual(u.reference_model([old,new],'Anthropic','fable','2026-01-01'),old)
        self.assertIsNone(u.reference_model([new,dict(new,id='duplicate')],'Anthropic','fable'))
        self.assertIsNone(u.reference_model([old,self.anchor('fable',None)],'Anthropic','fable'))

    def test_automatic_middle_effort_and_no_silent_fallback(self):
        headline=self.anchor('sonnet',56)
        middle=self.anchor('sonnet',40.8,suffix='-medium')
        self.assertEqual(u.reference_model([headline,middle],'Anthropic','sonnet'),middle)
        self.assertIsNone(u.reference_model([headline,middle,dict(middle,id='duplicate')],'Anthropic','sonnet'))
        self.assertIsNone(u.reference_model([headline,self.anchor('sonnet',None,suffix='-medium')],'Anthropic','sonnet'))

    def test_nearest_candidates_work_when_all_scores_are_below_reference(self):
        scores=[10,20,30,35,40,43,44,45]
        aa=[{'id':str(i),'slug':f'candidate-{i}','evaluations':{'artificial_analysis_intelligence_index':score}} for i,score in enumerate(scores)]
        models=u.build_models([model(f'candidate-{i}') for i in range(len(aa))],aa,4.3,{},'now')
        role=u.recommendations(models,[self.anchor('opus',51)])['opus']
        self.assertEqual(set(role['candidates']),{f'candidate-{i}' for i in range(2,8)})
        self.assertEqual(role['best'],'candidate-7')
        self.assertIsNone(role['empty_reason'])
        models += u.build_models([model('ancient')],[{'slug':'ancient','evaluations':{'artificial_analysis_intelligence_index':1}}],4.3,{},'now')
        self.assertEqual(u.recommendations(models,[self.anchor('opus',51)])['opus']['candidates'],role['candidates'])

    def test_duplicate_aliases_do_not_use_shortlist_slots(self):
        aa=[{'id':str(i),'slug':f'candidate-{i}','evaluations':{'artificial_analysis_intelligence_index':40+i}} for i in range(8)]
        models=u.build_models([model(f'candidate-{i}') for i in range(8)],aa,4.3,{},'now')
        alias=dict(models[-1],code='alias')
        role=u.recommendations(models+[alias],[self.anchor('sonnet',50)])['sonnet']
        self.assertEqual(len(role['candidates']),7)
        self.assertIn('candidate-2',role['candidates'])
        self.assertIn('alias',role['candidates'])

    def test_top_tiers_have_no_upper_bound(self):
        aa=[{'slug':f'candidate-{i}','evaluations':{'artificial_analysis_intelligence_index':score}} for i,score in enumerate([49,50,51,52,53,54,90])]
        models=u.build_models([model(f'candidate-{i}') for i in range(len(aa))],aa,4.3,{},'now')
        for tool,creator,key in [('claude','Anthropic','fable'),('codex','OpenAI','astra')]:
            role=u.recommendations(models,[self.anchor(key,50,creator=creator)],tool=tool)[key]
            self.assertEqual(len(role['candidates']),7)
            self.assertEqual(role['best'],'candidate-6')
            self.assertEqual(u.recommendations(models,[],tool=tool)[key]['candidates'],[])

    def test_tools_have_independent_reference_pools(self):
        aa=[{'slug':'candidate','evaluations':{'artificial_analysis_intelligence_index':40}}]
        models=u.build_models([model('candidate')],aa,4.3,{},'now')
        anchors=[self.anchor('sonnet',60),self.anchor('sol',40,creator='OpenAI')]
        self.assertEqual(u.recommendations(models,anchors)['sonnet']['reference']['score'],60)
        self.assertEqual(u.recommendations(models,anchors,tool='codex')['sol']['reference']['score'],40)
        self.assertEqual(u.recommendations(models,anchors,tool='codex')['sol']['candidates'],['candidate'])
        models[0]['features']=[]
        self.assertEqual(u.recommendations(models,anchors,tool='codex')['sol']['candidates'],[])
