import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-feedback-global',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback-global.html',
  styleUrls: ['./feedback-global.css']
})
export class FeedbackGlobalComponent {
  constructor(public feedback: FeedbackService) {}
}
