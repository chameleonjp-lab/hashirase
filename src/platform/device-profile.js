export const DEVICE_PROFILES=Object.freeze(['touch','desktop','hybrid']);
export function detectDeviceProfile({maxTouchPoints=0,finePointer=false,override}={}){
 if(override!==undefined){if(!DEVICE_PROFILES.includes(override))throw new TypeError('Invalid profile override');return override;}
 return maxTouchPoints>0?(finePointer?'hybrid':'touch'):'desktop';
}
