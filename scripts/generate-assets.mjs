import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
for(const size of [192,512])await sharp('public/icon.svg').resize(size,size).png().toFile('public/icon-'+size+'.png');
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
  const dir='android/app/src/main/res/mipmap-'+density;await mkdir(dir,{recursive:true});
  for(const name of ['ic_launcher','ic_launcher_round'])await sharp('public/icon.svg').resize(size,size).png().toFile(dir+'/'+name+'.png');
  await sharp('public/icon.svg').resize(size*2,size*2).png().toFile(dir+'/ic_launcher_foreground.png');
}
await mkdir('android/app/src/main/res/drawable',{recursive:true});
await writeFile('android/app/src/main/res/drawable/ic_launcher_foreground.xml','<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:strokeColor="#D4B87B" android:strokeWidth="2" android:fillColor="#00000000" android:pathData="M54,22 L75,54 L54,86 L33,54 Z M54,35 L66,54 L54,73 L42,54 Z"/><path android:strokeColor="#D4B87B" android:strokeWidth="2" android:pathData="M54,15 L54,22 M54,86 L54,93"/></vector>');
await writeFile('android/app/src/main/res/values/ic_launcher_background.xml','<resources><color name="ic_launcher_background">#151814</color></resources>');
console.log('Web and Android installation icons generated.');
