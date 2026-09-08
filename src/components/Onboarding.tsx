import {useState} from 'react';
import {Check,Plus} from 'lucide-react';
import {useApp} from '../lib/AppContext';
import {PageTitle,Button} from './ui';
import {FamilyEditor,CharacterEditor} from './Editors';
export function Onboarding(){
  const app=useApp(),[familyOpen,setFamilyOpen]=useState(false),[characterOpen,setCharacterOpen]=useState(false);
  const hasFamily=!!app.familyId;
  return <><PageTitle eyebrow="A NEW CHAPTER" title="Make this journey yours." description="Start with your family, then add the character you’re playing."/><section className="onboarding-grid"><div className={'onboard-card '+(hasFamily?'done':'')}><span className="step-number">{hasFamily?<Check size={20}/>:'01'}</span><h2>Your family</h2><p>Choose your PC region to keep your shared resources and progression together.</p><Button onClick={()=>setFamilyOpen(true)} disabled={hasFamily||app.offline}>{hasFamily?'Family created':'Create family'}<Plus size={16}/></Button></div><div className="onboard-card"><span className="step-number">02</span><h2>Your character</h2><p>Add a name, class, and level. You can enter equipment and your next goal as you go.</p><Button onClick={()=>setCharacterOpen(true)} disabled={!hasFamily||app.offline}>Add first character<Plus size={16}/></Button></div></section>{familyOpen&&<FamilyEditor onClose={()=>setFamilyOpen(false)}/>} {characterOpen&&<CharacterEditor onClose={()=>setCharacterOpen(false)}/>}</>;
}
