/* 公开示例套（非真题原文）。本地放入 data/papers.js 后优先加载真题。 */
window.PAPERS_DATA = [{
  id:'2024-12', label:'2024年12月',
  units:[
    {id:'close1', type:'close', name:'仔细阅读 Passage 1', ico:'book', learned:0, total:5,
     items:[
       {q:'According to the passage, what is the key factor behind people forgetting newly learned information during sleep?',
        opts:[
          {t:'The brain actively prunes weak connections', r:true},
          {t:'External noise interrupts memory consolidation'},
          {t:'Rapid eye movement reduces storage capacity'},
          {t:'Hormone levels drop sharply at night'}
        ],
        explain:'研究表明，睡眠期间大脑会主动修剪白天形成的弱突触连接，以便为次日的新信息腾出空间，这正是"睡一觉反而忘得更快"的主要原因。',
        words:[['prune','v. 修剪；删除'],['consolidation','n. 巩固；整合']],
        passage:'For years scientists believed that sleep simply gave the brain a chance to rest. Recent studies, however, suggest that the sleeping brain works hard to reorganize memories. It strengthens the connections that matter and prunes the ones that do not, much as a gardener trims a tree. The result is that some details are forgotten overnight while the gist of an experience survives.',
        hl:'prunes the ones that do not'},
       {q:'What does the author imply about "the gist of an experience" in Paragraph 1?',
        opts:[
          {t:'It tends to be preserved better than minor details', r:true},
          {t:'It is usually distorted during the night'},
          {t:'It requires repeated practice to survive'},
          {t:'It depends entirely on the dream content'}
        ],
        explain:'作者用"园丁修剪树枝"类比睡眠中的记忆整理：重要的主干（gist）被保留，琐碎细节被剪掉，说明记忆的主干信息比次要细节更容易留存。',
        words:[['gist','n. 要点；主旨'],['trim','v. 修剪']],
        passage:'For years scientists believed that sleep simply gave the brain a chance to rest. Recent studies, however, suggest that the sleeping brain works hard to reorganize memories. It strengthens the connections that matter and prunes the ones that do not, much as a gardener trims a tree. The result is that some details are forgotten overnight while the gist of an experience survives.',
        hl:'the gist of an experience survives'},
       {q:'According to the passage, when do the brain cells best process daytime information?',
        opts:[
          {t:'During the deep stages of sleep', r:true},
          {t:'Immediately after waking up'},
          {t:'While the body is exercising'},
          {t:'During short afternoon naps only'}
        ],
        explain:'实验显示，深睡阶段大脑会"回放"白天的经历并加以处理，相当于把临时文件写入长期存储；浅睡或频繁醒来都会打断这一过程。',
        words:[['replay','v. 回放；重演'],['long-term storage','长期存储']],
        passage:'Using electrodes, researchers tracked brain activity of volunteers as they learned word pairs and then slept. During deep sleep, the same patterns of brain activity reappeared—a replay of the daytime learning. The more often a pattern was replayed, the better the volunteer remembered the words the next morning.',
        hl:'the same patterns of brain activity reappeared'},
       {q:'What suggestion does the author give to students who study late at night?',
        opts:[
          {t:'They should prioritize a full night of sleep', r:true},
          {t:'They should review notes right before exams'},
          {t:'They should avoid eating before bedtime'},
          {t:'They should study in short bursts only'}
        ],
        explain:'作者最后建议：与其牺牲睡眠熬夜刷题，不如保证完整睡眠，让大脑在深睡中完成记忆加工，学习效率更高。',
        words:[['prioritize','v. 优先考虑']],
        passage:'For students, the message is clear: all-night study sessions are counterproductive. A full night of sleep allows the brain to finish the job that learning started. You do not study while you sleep; sleep is when you truly learn.',
        hl:'sleep is when you truly learn'},
       {q:'What is the main idea of the passage?',
        opts:[
          {t:'Sleep plays an active role in memory consolidation', r:true},
          {t:'Memory capacity decreases with age'},
          {t:'Dreams reflect hidden desires'},
          {t:'Daytime learning is more efficient than nighttime'}
        ],
        explain:'全文围绕"睡眠主动参与记忆巩固"展开：修剪弱连接、回放白天的学习、把信息写入长期记忆，因此主旨是睡眠在记忆巩固中扮演主动角色。',
        words:[['consolidate','v. 巩固'],['counterproductive','adj. 适得其反的']],
        passage:'For years scientists believed that sleep simply gave the brain a chance to rest. Recent studies, however, suggest that the sleeping brain works hard to reorganize memories. It strengthens the connections that matter and prunes the ones that do not, much as a gardener trims a tree.',
        hl:'the sleeping brain works hard to reorganize memories'}
     ]},
    {id:'listen1', type:'listen', name:'听力 · 讲话/报道', ico:'mic', learned:0, total:4,
     items:[
       {q:'What is the talk mainly about?', audio:true,
        opts:[
          {t:'The rise of urban rooftop gardens', r:true},
          {t:'The cost of organic vegetables'},
          {t:'Government funding for parks'},
          {t:'Techniques of vertical farming'}
        ],
        explain:'讲话围绕城市屋顶花园的兴起展开：从空间利用、降温效应到社区参与，主题是"城市屋顶花园的兴起"。',
        words:[['rooftop','n. 屋顶'],['vertical farming','垂直农业']]},
       {q:'According to the speaker, what benefit do rooftop gardens bring to cities?',
        opts:[
          {t:'They help lower local temperatures', r:true},
          {t:'They reduce traffic congestion'},
          {t:'They attract foreign tourists'},
          {t:'They increase housing prices'}
        ],
        explain:'讲话提到屋顶花园的植被可吸收热量、降低建筑周边温度，缓解城市热岛效应。',
        words:[['heat island effect','热岛效应']]},
       {q:'Why does the speaker mention the community program in the end?',
        opts:[
          {t:'To show rooftop gardens build social ties', r:true},
          {t:'To prove the program is expensive'},
          {t:'To compare different cities'},
          {t:'To introduce a new technology'}
        ],
        explain:'结尾的社区项目说明居民共同种植与照料，邻里关系因此更紧密——屋顶花园同时带来社交价值。',
        words:[['social ties','社会联系']]},
       {q:'What suggestion does the speaker give for future urban planning?', audio:true,
        opts:[
          {t:'Integrate green roofs into building codes', r:true},
          {t:'Ban private cars in city centers'},
          {t:'Build more underground parking'},
          {t:'Limit the height of new buildings'}
        ],
        explain:'讲话建议把屋顶绿化纳入建筑规范，使其成为新建筑的标配，而非可有可无的选项。',
        words:[['building codes','建筑规范'],['integrate','v. 整合']]}
     ]},
    {id:'cloze', type:'cloze', name:'选词填空', ico:'grid', learned:0, total:4,
     passage:'The new policy aims to ___1___ the gap between urban and rural education. Teachers reported that students became more ___2___ in class discussions. The program was ___3___ by a lack of qualified instructors. Researchers ___4___ the results carefully before publishing the report.',
     items:[
       {q:'第 1 空：The new policy aims to ___ the gap between urban and rural education.',
        opts:[{t:'narrow', r:true},{t:'abandon'},{t:'extend'},{t:'polish'}],
        explain:'narrow the gap（缩小差距）为固定搭配，符合"缩小城乡教育差距"的政策目标。',
        words:[['narrow the gap','缩小差距']]},
       {q:'第 2 空：Teachers reported that students became more ___ in class discussions.',
        opts:[{t:'engaged', r:true},{t:'reserved'},{t:'distracted'},{t:'absent'}],
        explain:'become engaged in（积极参与）符合语境：学生在课堂讨论中更投入。',
        words:[['engaged','adj. 投入的']]},
       {q:'第 3 空：The program was ___ by a lack of qualified instructors.',
        opts:[{t:'hampered', r:true},{t:'promoted'},{t:'celebrated'},{t:'measured'}],
        explain:'be hampered by（受……阻碍）：项目因缺乏合格教师而进展受阻。',
        words:[['hamper','v. 阻碍']]},
       {q:'第 4 空：Researchers ___ the results carefully before publishing the report.',
        opts:[{t:'verified', r:true},{t:'ignored'},{t:'printed'},{t:'rejected'}],
        explain:'verify the results（核实结果）符合科研流程：发表前仔细核实数据。',
        words:[['verify','v. 核实']]}
     ]},
    {id:'longmatch', type:'longmatch', name:'长篇阅读', ico:'list', learned:0, total:3,
     passage:'A) Social commerce is changing how people shop. Shoppers who browse social media are more likely to make impulse purchases after seeing product posts from influencers.\n\nB) A survey found that most young people check their phones within five minutes of waking. Morning screen time sets the pace for the rest of the day.\n\nC) Experts warn that constant notifications reduce the ability to focus. Each ping pulls attention away from deep work and deep reading.\n\nD) Some platforms now offer quiet hours and digest modes, hoping users will reclaim longer stretches of uninterrupted time.',
     items:[
       {q:'Shoppers who browse social media are more likely to make impulse purchases.',
        opts:[{t:'A', r:true},{t:'B'},{t:'C'},{t:'D'}],
        explain:'对应 A 段"刷社交媒体看到种草内容后冲动下单的比例上升"的表述。',
        words:[['impulse purchase','冲动消费']]},
       {q:'A survey found that most young people check their phones within five minutes of waking.',
        opts:[{t:'B', r:true},{t:'A'},{t:'C'},{t:'D'}],
        explain:'B 段数据：调查显示 78% 的年轻人起床后五分钟内查看手机。',
        words:[['within five minutes','五分钟内']]},
       {q:'Experts warn that constant notifications reduce the ability to focus.',
        opts:[{t:'C', r:true},{t:'A'},{t:'B'},{t:'D'}],
        explain:'C 段专家警告：频繁通知打断注意力，削弱专注能力。',
        words:[['notification','n. 通知'],['focus','v./n. 专注']]}
     ]},
    {id:'translate', type:'translate', name:'翻译', ico:'pen', learned:0, total:1,
     items:[
       {q:'翻译下面这段文字：\n\n中国高铁网络已成为全球最大的高速铁路系统，连接了全国绝大多数大城市，大大缩短了人们的出行时间。高铁不仅改变了人们的出行方式，也带动了沿线城市的经济增长。',
        opts:[{t:'查看参考译文', r:true}],
        explain:'参考译文：China\u2019s high-speed rail network has become the world\u2019s largest high-speed railway system, connecting most major cities across the country and greatly shortening people\u2019s travel time. It has not only changed the way people travel but also driven economic growth in cities along the routes.',
        words:[['high-speed rail','高铁'],['along the routes','沿线']]}
     ]},
    {id:'writing', type:'writing', name:'写作', ico:'edit', learned:0, total:1,
     items:[
       {q:'Directions: For this part, you are allowed 30 minutes to write an essay on the importance of building basic skills. You should write at least 120 words but no more than 180 words.',
        opts:[{t:'查看参考范文', r:true}],
        explain:'参考思路：先表明观点（基本功决定上层能力），再用学习/职场实例论证，最后总结建议。范文开头示例：Building basic skills is like laying the foundation of a building; no matter how ambitious the design, it can hardly stand without a solid base...',
        words:[['foundation','n. 基础'],['ambitious','adj. 雄心勃勃的']]}
     ]}
  ]
}];
