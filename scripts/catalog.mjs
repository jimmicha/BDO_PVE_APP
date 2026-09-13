// Reviewed 2026-09-07 against the NA/EU FAQ, Garmoth and NA quest data.
// No AP/DP values, prices, probabilities or additional upgrade recipes are certified.
export const catalog = {
  id:'ab100000-0000-4000-8000-000000000001', version:1,
  title:"Alustin's Kharazad journey", status:'published',
  checked_at:'2026-09-07', valid_until:'2026-10-07',
  effective_patch:'NA/EU HYPERBOOST live support FAQ, updated 2026-08-11',
  sources:[
    {name:'Pearl Abyss — NA/EU Kharazad support FAQ',url:'https://support.pearlabyss.com/blackdesert_naeu/en-US/Faq/Home/Detail?_faqNo=655',checked_at:'2026-09-07',scope:'Materials, six rewards, once-per-family limits'},
    {name:'Garmoth — HYPERBOOST Update',url:'https://garmoth.com/guides/post/hyperboost-update',checked_at:'2026-09-07',scope:'Olvia prerequisite and accessory rewards'},
    {name:'BDO Codex — NA quest prerequisite',url:'https://bdocodex.com/us/quest/2308/1/',checked_at:'2026-09-07',scope:'[Olvia Academy] Your First Steps In'}
  ],
  content:{
    platforms:['PC'],regions:['NA','EU'],
    resources:[{key:'essence_of_dawn',name:'Essence of Dawn'},{key:'sharp_black_crystal_shard',name:'Sharp Black Crystal Shard'}],
    items:[
      {key:'kharazad_necklace',name:'Kharazad Necklace',slots:['necklace'],enhancements:[20]},
      {key:'kharazad_belt',name:'Kharazad Belt',slots:['belt'],enhancements:[20]},
      {key:'kharazad_ring',name:'Kharazad Ring',slots:['ring_1','ring_2'],enhancements:[20]},
      {key:'kharazad_earring',name:'Kharazad Earring',slots:['earring_1','earring_2'],enhancements:[20]}
    ],
    steps:[
      {key:'olvia_enrollment',title:'Take your first steps at Olvia Academy',description:'Confirm completion of [Olvia Academy] Your First Steps In. Check the current enrollment window in-game; enrollment dates are not certified by this guide.',dependencies:[],requirements:[]},
      ...[
        ['necklace','Kharazad Necklace','kharazad_necklace'],
        ['belt','Kharazad Belt','kharazad_belt'],
        ['ring_1','Kharazad Ring I','kharazad_ring'],
        ['ring_2','Kharazad Ring II','kharazad_ring'],
        ['earring_1','Kharazad Earring I','kharazad_earring'],
        ['earring_2','Kharazad Earring II','kharazad_earring']
      ].map(([key,title,item])=>({
        key, category:'accessory', title:'Claim PEN (V) '+title,
        description:"Visit Alustin in Velia with the materials in your regular inventory. Enable all quest types if the support quest is hidden. Record only after completing the exchange in-game. This reward is available once per family.",
        dependencies:['olvia_enrollment'],requirements:[{resource_key:'essence_of_dawn',quantity:'10'},{resource_key:'sharp_black_crystal_shard',quantity:'50'}],
        claim_key:'alustin_support_'+key,reward:{item_key:item,enhancement:20}
      }))
    ]
  }
};
