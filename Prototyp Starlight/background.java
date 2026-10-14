import greenfoot.*;  // (World, Actor, GreenfootImage, Greenfoot and MouseInfo)

/**
 * Write a description of class background here.
 * 
 * @author (your name) 
 * @version (a version number or a date)
 */
public class background extends Actor
{
    int s = 5;//speedvariable
    int l =0; //move x
    int r = 100;//range
    /**
     * Act - do whatever the background wants to do. This method is called whenever
     * the 'Act' or 'Run' button gets pressed in the environment.
     */
    public void act()
    {
        mo();    
    }
    public void mo()
    {
        if(Greenfoot.isKeyDown("A")==true && l<r)
        {
            move(s);  
            l=l+5;
        }
        if(Greenfoot.isKeyDown("D")==true && l>-r)
        {
            move(-s);
            l=l-5;
        }
    }
}
