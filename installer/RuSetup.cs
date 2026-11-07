// Ru Motion Setup (Windows). One window: Install, progress, Finish. No console window.
// Copies the embedded panel (resource "RuMotion.zip") to %APPDATA%\Adobe\CEP\extensions\RuMotion and sets
// PlayerDebugMode = 1 for CSXS 9..13 (same steps as the old install.bat).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

class RoundButton : Control
{
    public bool Primary;
    bool hot, down;
    public RoundButton(string text, bool primary)
    {
        Text = text; Primary = primary; Cursor = Cursors.Hand; Size = new Size(Primary ? 150 : 110, 40);
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
    }
    protected override void OnMouseEnter(EventArgs e) { hot = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hot = false; down = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { down = true; Invalidate(); base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { down = false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnKeyDown(KeyEventArgs e) { if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) OnClick(EventArgs.Empty); base.OnKeyDown(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
        using (GraphicsPath p = Setup.Round(r, Height / 2))
        {
            Color fill = Primary ? Setup.Primary : Setup.Card;
            if (hot) fill = Primary ? Color.FromArgb(232, 255, 90) : Color.FromArgb(52, 54, 60);
            if (down) fill = Primary ? Color.FromArgb(200, 228, 40) : Color.FromArgb(36, 38, 42);
            using (Brush b = new SolidBrush(fill)) g.FillPath(b, p);
            if (!Primary) using (Pen pen = new Pen(hot ? Setup.Hint : Setup.Line)) g.DrawPath(pen, p);
            if (Focused && Primary) using (Pen pen = new Pen(Color.White, 2)) { Rectangle f = new Rectangle(3, 3, Width - 7, Height - 7); using (GraphicsPath fp = Setup.Round(f, f.Height / 2)) g.DrawPath(pen, fp); }
        }
        using (Font f = new Font("Segoe UI Semibold", 10.5f))
        using (Brush b = new SolidBrush(Primary ? Setup.OnPrimary : Setup.Ink))
        {
            StringFormat sf = new StringFormat(); sf.Alignment = StringAlignment.Center; sf.LineAlignment = StringAlignment.Center;
            g.DrawString(Text, f, b, new RectangleF(0, 0, Width, Height), sf);
        }
    }
}

class Setup : Form
{
    // palette (same as the panel)
    public static readonly Color Page = Color.FromArgb(0x1C, 0x1D, 0x20), Surface = Color.FromArgb(0x23, 0x24, 0x28), Card = Color.FromArgb(0x2B, 0x2D, 0x31),
        Line = Color.FromArgb(0x3C, 0x3E, 0x43), Ink = Color.FromArgb(0xF1, 0xF2, 0xF4), Label = Color.FromArgb(0xBE, 0xC0, 0xC4),
        Hint = Color.FromArgb(0x90, 0x93, 0x9A), Primary = Color.FromArgb(0xDC, 0xFA, 0x37), OnPrimary = Color.FromArgb(0x10, 0x10, 0x10),
        Bad = Color.FromArgb(0xFF, 0x7A, 0x6B);

    // Website shown in the bottom box. Empty = the box is hidden.
    const string SITE = "";
    const string VERSION = "1.0";
    const int W = 720, H = 460, BAR = 36, HERO = 210;

    int stage;            // 0 welcome, 1 installing, 2 done, 3 error
    float shown;          // progress drawn (0..100)
    float target;         // progress wanted
    int step;             // current step 0..3
    string what = "", error = "", aeExe;
    bool aeFound, openAe = true;
    RoundButton bInstall, bCancel, bFinish, bClose;
    Rectangle rSite, rCheck, rMin, rX;
    System.Windows.Forms.Timer timer;
    Point dragFrom; bool dragging;
    readonly string[] steps = { "Checking After Effects", "Copying Ru Motion", "Turning the panel on", "Finishing up" };
    static readonly Random rnd = new Random(7);
    PointF[] dots = new PointF[46]; float[] dotR = new float[46];

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Setup());
    }

    public static GraphicsPath Round(Rectangle r, int radius)
    {
        int d = Math.Max(1, radius * 2);
        GraphicsPath p = new GraphicsPath();
        p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure(); return p;
    }

    public Setup()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
        Text = "Ru Motion Setup";
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(W, H); BackColor = Surface; DoubleBuffered = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        for (int i = 0; i < dots.Length; i++) { dots[i] = new PointF((float)rnd.NextDouble() * W, BAR + (float)rnd.NextDouble() * HERO); dotR[i] = (float)rnd.NextDouble() * 1.8f + 0.5f; }

        bInstall = new RoundButton("Install", true);
        bCancel = new RoundButton("Cancel", false);
        bFinish = new RoundButton("Finish", true);
        bClose = new RoundButton("Close", false);
        PlaceButtons();
        Controls.AddRange(new Control[] { bInstall, bCancel, bFinish, bClose });
        bInstall.Click += delegate { StartInstall(); };
        bCancel.Click += delegate { Close(); };
        bClose.Click += delegate { Close(); };
        bFinish.Click += delegate { if (openAe && aeExe != null) { try { Process.Start(aeExe); } catch { } } Close(); };
        rMin = new Rectangle(W - 78, 0, 38, BAR); rX = new Rectangle(W - 40, 0, 40, BAR);
        rSite = new Rectangle(22, H - 56, W - 44, 38);
        rCheck = new Rectangle(22, BAR + HERO + 56, 260, 22);

        aeExe = FindAfterEffects(); aeFound = aeExe != null;
        timer = new System.Windows.Forms.Timer(); timer.Interval = 30;
        timer.Tick += delegate
        {
            if (shown < target) { shown = Math.Min(target, shown + Math.Max(0.6f, (target - shown) * 0.12f)); }
            if (stage == 0 || stage == 1) { for (int i = 0; i < dots.Length; i++) { dots[i].Y -= 0.12f * (0.4f + dotR[i] * 0.3f); if (dots[i].Y < BAR) dots[i].Y = BAR + HERO; } }
            Invalidate(new Rectangle(0, BAR, W, H - BAR));
        };
        timer.Start();
        SetStage(0);
    }

    static string FindAfterEffects()
    {
        try
        {
            string[] roots = { Environment.GetEnvironmentVariable("ProgramFiles"), Environment.GetEnvironmentVariable("ProgramFiles(x86)") };
            string best = null;
            foreach (string r in roots)
            {
                if (string.IsNullOrEmpty(r)) continue;
                string adobe = Path.Combine(r, "Adobe");
                if (!Directory.Exists(adobe)) continue;
                foreach (string d in Directory.GetDirectories(adobe, "Adobe After Effects*"))
                {
                    string exe = Path.Combine(Path.Combine(d, "Support Files"), "AfterFX.exe");
                    if (File.Exists(exe) && (best == null || string.Compare(exe, best, StringComparison.OrdinalIgnoreCase) > 0)) best = exe;
                }
            }
            return best;
        }
        catch { return null; }
    }

    void PlaceButtons()
    {
        int y = SITE.Length > 0 ? H - 110 : H - 62;
        bInstall.Location = new Point(W - 22 - 150, y); bCancel.Location = new Point(W - 22 - 150 - 12 - 110, y);
        bFinish.Location = new Point(W - 22 - 150, y); bClose.Location = new Point(W - 22 - 110, y);
    }

    void SetStage(int s)
    {
        stage = s;
        bInstall.Visible = bCancel.Visible = (s == 0);
        bFinish.Visible = (s == 2); bClose.Visible = (s == 3);
        Invalidate();
        if (s == 0) bInstall.Focus(); else if (s == 2) bFinish.Focus();
    }

    // ---- install ----
    void StartInstall()
    {
        stage = 1; step = 0; shown = 0; target = 0; what = "Starting…"; SetStage(1);
        Thread t = new Thread(delegate ()
        {
            try { Work(); }
            catch (Exception ex) { Ui(delegate { error = ex.Message; SetStage(3); }); }
        });
        t.IsBackground = true; t.Start();
    }

    void Ui(MethodInvoker a) { try { if (!IsDisposed) BeginInvoke(a); } catch { } }
    void Go(int s, float pct) { Ui(delegate { step = s; what = steps[s] + "…"; target = pct; }); }

    void Work()
    {
        Go(0, 8); Thread.Sleep(450);
        string appdata = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string dest = Path.Combine(Path.Combine(Path.Combine(Path.Combine(appdata, "Adobe"), "CEP"), "extensions"), "RuMotion");

        Go(1, 30); Thread.Sleep(300);
        string tmp = Path.Combine(Path.GetTempPath(), "RuMotion-setup-" + Guid.NewGuid().ToString("N") + ".zip");
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("RuMotion.zip"))
        {
            if (s == null) throw new Exception("The panel files are missing from this installer. Download it again.");
            using (FileStream f = File.Create(tmp)) { byte[] buf = new byte[81920]; int n; while ((n = s.Read(buf, 0, buf.Length)) > 0) f.Write(buf, 0, n); }
        }
        try
        {
            if (Directory.Exists(dest)) Directory.Delete(dest, true);
            Directory.CreateDirectory(dest);
            ZipFile.ExtractToDirectory(tmp, dest);
        }
        catch (UnauthorizedAccessException) { throw new Exception("Could not write to " + dest + ". Close After Effects and try again."); }
        catch (IOException ex) { throw new Exception("Could not copy the files (" + ex.Message + "). Close After Effects and try again."); }
        finally { try { File.Delete(tmp); } catch { } }
        Go(1, 62); Thread.Sleep(250);

        Go(2, 78); Thread.Sleep(300);
        foreach (int v in new int[] { 9, 10, 11, 12, 13 })
        {
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey("Software\\Adobe\\CSXS." + v))
                k.SetValue("PlayerDebugMode", "1", RegistryValueKind.String);
        }
        Go(3, 100); Thread.Sleep(500);
        Ui(delegate { target = 100; step = 4; what = "Done"; });
        Thread.Sleep(450);
        Ui(delegate { SetStage(2); });
    }

    // ---- window chrome ----
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left)
        {
            if (rX.Contains(e.Location)) { Close(); return; }
            if (rMin.Contains(e.Location)) { WindowState = FormWindowState.Minimized; return; }
            if (SITE.Length > 0 && rSite.Contains(e.Location)) { try { Process.Start(SITE.StartsWith("http") ? SITE : "https://" + SITE); } catch { } return; }
            if (stage == 2 && aeExe != null && rCheck.Contains(e.Location)) { openAe = !openAe; Invalidate(rCheck); return; }
            if (e.Y < BAR) { dragging = true; dragFrom = e.Location; }
        }
        base.OnMouseDown(e);
    }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        if (dragging) { Location = new Point(Location.X + e.X - dragFrom.X, Location.Y + e.Y - dragFrom.Y); }
        else
        {
            bool hand = (SITE.Length > 0 && rSite.Contains(e.Location)) || (stage == 2 && aeExe != null && rCheck.Contains(e.Location)) || rX.Contains(e.Location) || rMin.Contains(e.Location);
            Cursor = hand ? Cursors.Hand : Cursors.Default;
        }
        base.OnMouseMove(e);
    }
    protected override void OnMouseUp(MouseEventArgs e) { dragging = false; base.OnMouseUp(e); }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.Escape && stage != 1) { Close(); return true; }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    // ---- painting ----
    static void DrawLogo(Graphics g, RectangleF r, float radiusFrac)
    {
        using (GraphicsPath p = Round(Rectangle.Round(r), (int)(r.Width * radiusFrac)))
        using (Brush b = new SolidBrush(Primary)) g.FillPath(b, p);
        foreach (float[] a in LogoData.Shapes)
        {
            PointF[] pts = new PointF[a.Length / 2];
            for (int i = 0; i < pts.Length; i++) pts[i] = new PointF(r.X + a[i * 2] * r.Width, r.Y + a[i * 2 + 1] * r.Height);
            using (Brush b = new SolidBrush(OnPrimary)) g.FillPolygon(b, pts);
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        g.Clear(Surface);

        // title bar
        using (Brush b = new SolidBrush(Page)) g.FillRectangle(b, 0, 0, W, BAR);
        DrawLogo(g, new RectangleF(12, 10, 16, 16), 0.28f);
        using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Hint)) g.DrawString("Ru Motion Setup", f, b, 36, 9);
        using (Pen p = new Pen(Hint, 1.4f))
        {
            g.DrawLine(p, rMin.X + 13, BAR / 2 + 3, rMin.X + 25, BAR / 2 + 3);
            g.DrawLine(p, rX.X + 14, BAR / 2 - 5, rX.X + 26, BAR / 2 + 5); g.DrawLine(p, rX.X + 26, BAR / 2 - 5, rX.X + 14, BAR / 2 + 5);
        }
        using (Pen p = new Pen(Line)) g.DrawLine(p, 0, BAR - 1, W, BAR - 1);

        // hero
        Rectangle hero = new Rectangle(0, BAR, W, HERO);
        using (LinearGradientBrush b = new LinearGradientBrush(hero, Color.FromArgb(0x2B, 0x2D, 0x31), Color.FromArgb(0x1C, 0x1D, 0x20), 45f)) g.FillRectangle(b, hero);
        using (GraphicsPath gp = new GraphicsPath())
        {
            gp.AddEllipse(W - 520, BAR - 180, 760, 420);
            using (PathGradientBrush pg = new PathGradientBrush(gp))
            {
                pg.CenterColor = Color.FromArgb(70, 220, 250, 55); pg.SurroundColors = new Color[] { Color.FromArgb(0, 220, 250, 55) };
                Region old = g.Clip; g.SetClip(hero); g.FillPath(pg, gp); g.Clip = old;
            }
        }
        for (int i = 0; i < dots.Length; i++)
            using (Brush b = new SolidBrush(Color.FromArgb(40 + (int)(dotR[i] * 30), 220, 250, 55))) g.FillEllipse(b, dots[i].X, dots[i].Y, dotR[i] * 2, dotR[i] * 2);
        DrawLogo(g, new RectangleF(22, BAR + HERO - 22 - 56, 56, 56), 0.25f);
        using (Font f = new Font("Segoe UI Semibold", 22f)) using (Brush b = new SolidBrush(Ink)) g.DrawString("Ru Motion", f, b, 90, BAR + HERO - 22 - 56 - 2);
        using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Label)) g.DrawString("Motion toolkit for After Effects · Version " + VERSION, f, b, 92, BAR + HERO - 22 - 20);

        int y0 = BAR + HERO + 22;
        if (stage == 0)
        {
            using (Font f = new Font("Segoe UI Semibold", 11f)) using (Brush b = new SolidBrush(Ink)) g.DrawString("Ready to install Ru Motion for After Effects.", f, b, 22, y0 + 2);
            if (aeFound) { using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Hint)) g.DrawString("After Effects found. Installs for your Windows account only.", f, b, 22, y0 + 28); }
            else { using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Bad)) g.DrawString("After Effects was not found on this PC. You can still install.", f, b, 22, y0 + 28); }
        }
        else if (stage == 1)
        {
            for (int i = 0; i < steps.Length; i++)
            {
                int y = y0 + i * 22;
                bool ok = i < step, cur = i == step;
                Rectangle c = new Rectangle(22, y + 2, 16, 16);
                if (ok) { using (Brush b = new SolidBrush(Primary)) g.FillEllipse(b, c); using (Pen p = new Pen(OnPrimary, 2)) { g.DrawLine(p, c.X + 4, c.Y + 8, c.X + 7, c.Y + 11); g.DrawLine(p, c.X + 7, c.Y + 11, c.X + 12, c.Y + 5); } }
                else using (Pen p = new Pen(cur ? Primary : Line, 2)) g.DrawEllipse(p, c.X + 1, c.Y + 1, 14, 14);
                using (Font f = new Font("Segoe UI", 10f)) using (Brush b = new SolidBrush(ok ? Label : (cur ? Ink : Hint))) g.DrawString(steps[i], f, b, 48, y);
            }
            Rectangle pr = new Rectangle(22, y0 + 4 * 22 + 8, W - 44, 8);
            using (GraphicsPath p = Round(pr, 4)) { using (Brush b = new SolidBrush(Card)) g.FillPath(b, p); using (Pen pen = new Pen(Line)) g.DrawPath(pen, p); }
            int fw = (int)((pr.Width) * shown / 100f);
            if (fw > 8) using (GraphicsPath p = Round(new Rectangle(pr.X, pr.Y, fw, pr.Height), 4)) using (Brush b = new SolidBrush(Primary)) g.FillPath(b, p);
            using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Label)) { g.DrawString(what, f, b, 22, pr.Bottom + 6); }
            using (Font f = new Font("Segoe UI Semibold", 9f)) using (Brush b = new SolidBrush(Ink)) { string t = (int)shown + "%"; SizeF sz = g.MeasureString(t, f); g.DrawString(t, f, b, W - 22 - sz.Width, pr.Bottom + 6); }
        }
        else if (stage == 2)
        {
            using (Font f = new Font("Segoe UI Semibold", 14f)) using (Brush b = new SolidBrush(Ink)) g.DrawString("Ru Motion is installed", f, b, 22, y0);
            using (Font f = new Font("Segoe UI", 9.5f)) using (Brush b = new SolidBrush(Label)) g.DrawString("Restart After Effects, then open Window › Extensions › Ru Motion.", f, b, 22, y0 + 30);
            if (aeExe != null)
            {
                Rectangle c = new Rectangle(rCheck.X, rCheck.Y + 3, 16, 16);
                using (GraphicsPath p = Round(c, 4)) { if (openAe) using (Brush b = new SolidBrush(Primary)) g.FillPath(b, p); else using (Pen pen = new Pen(Line, 2)) g.DrawPath(pen, p); }
                if (openAe) using (Pen p = new Pen(OnPrimary, 2)) { g.DrawLine(p, c.X + 4, c.Y + 8, c.X + 7, c.Y + 11); g.DrawLine(p, c.X + 7, c.Y + 11, c.X + 12, c.Y + 5); }
                using (Font f = new Font("Segoe UI", 9.5f)) using (Brush b = new SolidBrush(Label)) g.DrawString("Open After Effects now", f, b, c.Right + 10, rCheck.Y + 2);
            }
        }
        else
        {
            using (Font f = new Font("Segoe UI Semibold", 14f)) using (Brush b = new SolidBrush(Bad)) g.DrawString("Install did not finish", f, b, 22, y0);
            using (Font f = new Font("Segoe UI", 9.5f)) using (Brush b = new SolidBrush(Label)) g.DrawString(error, f, b, new RectangleF(22, y0 + 30, W - 44, 60));
        }

        // website box
        if (SITE.Length > 0)
        {
            using (GraphicsPath p = Round(rSite, 10)) { using (Brush b = new SolidBrush(Card)) g.FillPath(b, p); using (Pen pen = new Pen(Line)) g.DrawPath(pen, p); }
            using (Font f = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Hint)) g.DrawString("Tutorials, updates and support", f, b, rSite.X + 14, rSite.Y + 11);
            using (Font f = new Font("Segoe UI Semibold", 9f)) using (Brush b = new SolidBrush(Primary))
            { string t = SITE + "  ↗"; SizeF sz = g.MeasureString(t, f); g.DrawString(t, f, b, rSite.Right - 14 - sz.Width, rSite.Y + 11); }
        }
        using (Pen p = new Pen(Line)) g.DrawRectangle(p, 0, 0, W - 1, H - 1);
    }
}
