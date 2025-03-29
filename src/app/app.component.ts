import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {H264Component} from "../h264/h264.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, H264Component],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'h264test';
}
