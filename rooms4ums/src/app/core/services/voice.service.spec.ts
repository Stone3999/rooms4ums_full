import { TestBed } from '@angular/core/testing';

import { isRecoverableMicrophoneError, VoiceService } from './voice.service';

describe('VoiceService', () => {
  let service: VoiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VoiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('allows listen-only joins when microphone access is unavailable', () => {
    const missingMicrophone = new DOMException('No microphone found', 'NotFoundError');
    const deniedPermission = new DOMException('Permission denied', 'NotAllowedError');

    expect(isRecoverableMicrophoneError(missingMicrophone)).toBeTrue();
    expect(isRecoverableMicrophoneError(deniedPermission)).toBeTrue();
    expect(isRecoverableMicrophoneError(new Error('Socket disconnected'))).toBeFalse();
  });
});
