import {describe,it,expect} from 'vitest';
import {AudioManager} from './AudioManager';
import {attachAudioMonitor} from './audioMonitor';
describe('audio monitor taps',()=>{
 it('declines to attach before an AudioContext exists',()=>{
  const audio=new AudioManager();
  expect(attachAudioMonitor(audio)).toBeNull();
  audio.dispose();
 });
});
