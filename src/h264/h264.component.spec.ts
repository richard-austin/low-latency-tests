import { ComponentFixture, TestBed } from '@angular/core/testing';

import { H264Component } from './h264.component';

describe('H264Component', () => {
  let component: H264Component;
  let fixture: ComponentFixture<H264Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [H264Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(H264Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
